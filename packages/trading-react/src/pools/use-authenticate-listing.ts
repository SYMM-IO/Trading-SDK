"use client";

import {
  authenticateListingMutationOptions,
  getListingSignInMessageQueryOptions,
  type AuthenticateListingParameters,
  type ConfigParameter,
  type ListingAuthToken,
  type ListingSignInMessage,
} from "@symmio/trading-core";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useAuthenticateListing}: optional prefetch controls and `config`. */
export type UseAuthenticateListingParameters = ConfigParameter & {
  /** Fetch a single-use challenge after a wallet connects. Defaults to false. */
  prefetchChallenge?: boolean;
  /** Explicit deployment, independent of the wallet chain. */
  chainId?: number;
  /** Explicit signing account for an injected or embedded signer. */
  from?: Address;
  domain?: string;
  uri?: string;
  statement?: string;
};

/**
 * Variables for the {@link useAuthenticateListing} mutation.
 *
 * `domain` and `uri` are optional here — omit them and the hook fills them from
 * the current `window.location` (`host` / `origin`). Pass them explicitly to
 * override (e.g. to bind the SIWE message to a canonical domain).
 */
export type AuthenticateListingVariables = Omit<AuthenticateListingParameters, "domain" | "uri"> & {
  /** RFC 4501 DNS authority requesting the sign-in. Defaults to `window.location.host`. */
  domain?: string;
  /** RFC 3986 URI of the dApp. Defaults to `window.location.origin`. */
  uri?: string;
};

/** Return type of {@link useAuthenticateListing}: the issued bearer token or a normalized error. */
export type UseAuthenticateListingReturnType = UseMutationResult<
  ListingAuthToken,
  SymmioRequestError,
  AuthenticateListingVariables
> & {
  /** Current prefetched challenge, or undefined before it is available. */ challenge: ListingSignInMessage | undefined;
};

/**
 * Sign in to the listing backend with SIWE (EIP-4361) in one call.
 *
 * The mutation runs the whole flow — fetch the sign-in message, sign it with the
 * connected wallet, and POST the login — and resolves to the issued bearer token
 * `{ accessToken, tokenType }`. Present it as an `Authorization: Bearer
 * <accessToken>` header on subsequent authenticated Pools requests.
 *
 * `domain` and `uri` default to the current origin (`window.location.host` /
 * `window.location.origin`); pass them to override. Pools is **chain-level**
 * — `mutate` / `mutateAsync` reject with a normalized {@link SymmioRequestError}
 * (`LISTING_NOT_CONFIGURED`) on a chain with no listing backend. Failures are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { mutate, data, isPending } = useAuthenticateListing();
 * // domain / uri auto-fill from the current origin:
 * mutate({});
 * // …later:
 * if (data) headers.Authorization = `${data.tokenType} ${data.accessToken}`;
 * ```
 */
export function useAuthenticateListing(
  parameters: UseAuthenticateListingParameters = {},
): UseAuthenticateListingReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChain = useSymmioChainId();
  const chainId = parameters.chainId ?? connectedChain;
  const connection = useConnection();
  const address = parameters.from ?? connection.address;
  const queryClient = useQueryClient();
  const locationHref = useSyncExternalStore(subscribeLocation, readLocation, readServerLocation);
  const location = locationHref == null ? undefined : new URL(locationHref);
  const domain = parameters.domain ?? location?.host;
  const uri = parameters.uri ?? location?.origin;
  const prefetch = !!parameters.prefetchChallenge && !!address && !!domain && !!uri;
  const [attempts, setAttempts] = useState(0);
  const challengeOptions = getListingSignInMessageQueryOptions(config, {
    chainId,
    address: address ?? "0x0000000000000000000000000000000000000000",
    domain: domain ?? "",
    uri: uri ?? "",
    statement: parameters.statement,
    query: {
      enabled: prefetch && attempts === 0,
      retry: false,
      staleTime: Infinity,
      gcTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });
  const { data: challenge, refetch: refetchChallenge } = useQuery(challengeOptions);
  const identity = JSON.stringify(challengeOptions.queryKey);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const expirationTime = challenge?.params.expirationTime;
  useEffect(() => {
    if (!prefetch || attempts > 0 || !expirationTime) return;
    const expires = Date.parse(expirationTime);
    if (!Number.isFinite(expires)) return;
    const timer = setTimeout(
      () => {
        void refetchChallenge();
      },
      Math.max(1000, Math.min(2147483647, expires - Date.now() - 1000)),
    );
    return () => clearTimeout(timer);
  }, [prefetch, attempts, expirationTime, refetchChallenge]);
  const options = authenticateListingMutationOptions(config);

  const mutation = useMutation({
    ...options,
    mutationFn: async (variables: AuthenticateListingVariables) => {
      const domain = variables.domain ?? parameters.domain ?? window.location.host;
      const uri = variables.uri ?? parameters.uri ?? window.location.origin;
      const statement = variables.statement ?? parameters.statement;
      const cached = prefetch ? queryClient.getQueryData<ListingSignInMessage>(challengeOptions.queryKey) : undefined;
      // Remove before signing so two hook instances cannot consume the same nonce.
      if (prefetch) {
        setAttempts((count) => count + 1);
        const cancellation = queryClient.cancelQueries({ queryKey: challengeOptions.queryKey, exact: true });
        queryClient.removeQueries({ queryKey: challengeOptions.queryKey, exact: true });
        await cancellation;
      }
      const fits =
        cached &&
        cached.params.domain === domain &&
        cached.params.uri === uri &&
        (cached.params.statement ?? "") === (statement ?? "") &&
        cached.params.chainId === (variables.chainId ?? chainId) &&
        (!cached.params.expirationTime || Date.parse(cached.params.expirationTime) > Date.now());
      const signInMessage = variables.signInMessage ?? (fits ? cached : undefined);
      try {
        return await options.mutationFn({
          ...variables,
          domain,
          uri,
          ...(statement === undefined ? {} : { statement }),
          ...(parameters.from === undefined ? {} : { from: variables.from ?? parameters.from }),
          ...(signInMessage === undefined ? {} : { signInMessage }),
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      } finally {
        if (prefetch) {
          if (currentIdentity.current === identity)
            void queryClient.fetchQuery({ ...challengeOptions, staleTime: 0 }).catch(() => undefined);
          setAttempts((count) => count - 1);
        }
      }
    },
  });
  return { ...mutation, challenge: prefetch ? challenge : undefined } as UseAuthenticateListingReturnType;
}

function readLocation() {
  return window.location.href;
}
function readServerLocation() {
  return null;
}
function subscribeLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}
