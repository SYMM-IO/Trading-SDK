"use client";

import {
  getTokenPriceQueryOptions,
  type ConfigParameter,
  type GetTokenPriceOptions,
  type GetTokenPriceReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useTokenPrice}: the core query options plus an optional `config`. */
export type UseTokenPriceParameters = GetTokenPriceOptions & ConfigParameter;

/** Return type of {@link useTokenPrice}: the token's pre-listing price estimate. */
export type UseTokenPriceReturnType = UseQueryResult<GetTokenPriceReturnType, SymmioRequestError>;

/**
 * Read a pre-listing **price estimate** for a token — what the Price Service
 * thinks one unit is worth in USD, before (or regardless of whether) the token
 * is listed as a pool. The read a create-pool form shows next to the address
 * the user just pasted.
 *
 * This is an authed read: it takes a Bearer `accessToken` from
 * {@link useAuthenticateListing}, the token's `chain` by vendor name
 * (`TokenPriceChain`, not a numeric chain id), and its `tokenAddress`. The
 * token and the address both gate the query: until the `accessToken` **and**
 * the `tokenAddress` are non-empty strings the hook stays idle
 * (`enabled: false`) rather than firing an incomplete or unauthenticated
 * request, so it can be mounted before sign-in or before an address is typed.
 *
 * The figure is an **estimate**, not a mark or trade price: the backend caches
 * it for about five minutes and rate-limits the endpoint, so the query defaults
 * to a five-minute `staleTime` / `gcTime` and the same inputs inside that
 * window are served from the cache with no refetch. Render it with a `~` and
 * do not poll — pass `query.staleTime` only if you really need it fresher.
 * Enigma-only; errors are normalized to {@link SymmioRequestError}, with a
 * `401` meaning the token is bad or expired.
 *
 * @example
 * ```tsx
 * const login = useAuthenticateListing();
 * const [token, setToken] = useState("");
 * const [address, setAddress] = useState("");
 *
 * const { data, isPending } = useTokenPrice({
 *   accessToken: token,
 *   chain: TokenPriceChain.ARC,
 *   tokenAddress: address,
 * });
 *
 * // sign in first, then feed the token to the hook:
 * login.mutate({}, { onSuccess: (result) => setToken(result.accessToken) });
 *
 * // the estimate, once the user has pasted an address:
 * data ? `~$${data.price}` : "—";
 * ```
 */
export function useTokenPrice(parameters: UseTokenPriceParameters): UseTokenPriceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getTokenPriceQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled:
      (parameters.query?.enabled ?? true) && parameters.accessToken.length > 0 && parameters.tokenAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseTokenPriceReturnType;
}
