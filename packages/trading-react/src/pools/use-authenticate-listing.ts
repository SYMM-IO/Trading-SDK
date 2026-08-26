"use client";

import {
  authenticateListingMutationOptions,
  type AuthenticateListingParameters,
  type ConfigParameter,
  type ListingAuthToken,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useAuthenticateListing}: just an optional `config`. */
export type UseAuthenticateListingParameters = ConfigParameter;

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
>;

/**
 * Sign in to the listing backend with SIWE (EIP-4361) in one call.
 *
 * The mutation runs the whole flow — fetch the sign-in message, sign it with the
 * connected wallet, and POST the login — and resolves to the issued bearer token
 * `{ accessToken, tokenType }`. Present it as an `Authorization: Bearer
 * <accessToken>` header on subsequent authenticated Pools requests.
 *
 * `domain` and `uri` default to the current origin (`window.location.host` /
 * `window.location.origin`); pass them to override. This flow is **Enigma-only**
 * — `mutate` / `mutateAsync` reject with a normalized {@link SymmioRequestError}
 * (`LISTING_UNSUPPORTED`) on any other solver. Failures are normalized to
 * {@link SymmioRequestError}.
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
  const chainId = useSymmioChainId();
  const options = authenticateListingMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: AuthenticateListingVariables) => {
      const domain = variables.domain ?? window.location.host;
      const uri = variables.uri ?? window.location.origin;
      try {
        return await options.mutationFn({
          ...variables,
          domain,
          uri,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseAuthenticateListingReturnType;
}
