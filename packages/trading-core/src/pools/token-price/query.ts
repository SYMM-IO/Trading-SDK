import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getTokenPrice, type GetTokenPriceParameters, type GetTokenPriceReturnType } from "./get-token-price";

/**
 * Default cache lifetime for a token price estimate.
 *
 * The listing backend caches the figure for about five minutes and rate-limits
 * the endpoint (cached responses count against the limit), so asking sooner
 * returns the same number and burns quota. Both `staleTime` and `gcTime`
 * default to this; override per call through `query` if you need it fresher.
 */
const TOKEN_PRICE_CACHE_TIME_MS = 5 * 60 * 1000;

/** Data resolved by the {@link getTokenPriceQueryOptions} query. */
export type GetTokenPriceData = GetTokenPriceReturnType;

/**
 * Build the TanStack Query key for {@link getTokenPriceQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension, so two calls that differ only by a
 * refreshed token still hit the same cache entry (and the token never leaks into
 * a devtools-visible key).
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getTokenPriceQueryKey(options: Compute<GetTokenPriceParameters & ConfigKeyParameter>) {
  return ["getTokenPrice", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getTokenPriceQueryKey}. */
export type GetTokenPriceQueryKey = ReturnType<typeof getTokenPriceQueryKey>;

/**
 * Options accepted by {@link getTokenPriceQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetTokenPriceOptions = Compute<
  GetTokenPriceParameters & QueryParameter<GetTokenPriceData, Error, GetTokenPriceData, GetTokenPriceQueryKey>
>;

/** TanStack Query options returned by {@link getTokenPriceQueryOptions}. */
export type GetTokenPriceQueryOptions = SymmioQueryOptions<
  GetTokenPriceData,
  Error,
  GetTokenPriceData,
  GetTokenPriceQueryKey
>;

/**
 * Build TanStack Query options for {@link getTokenPrice}.
 *
 * The endpoint is a POST, but it is modeled as a query because it is an
 * idempotent read the UI fetches when a token is picked. `staleTime` and
 * `gcTime` default to five minutes to match the backend's own cache and spare
 * its rate limit; a `query.staleTime` / `query.gcTime` override wins.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getTokenPriceQueryOptions(config, {
 *     accessToken,
 *     chain: TokenPriceChain.ARC,
 *     tokenAddress: "0x648A…620a",
 *   }),
 * );
 * ```
 */
export function getTokenPriceQueryOptions(config: Config, options: GetTokenPriceOptions): GetTokenPriceQueryOptions {
  return {
    staleTime: TOKEN_PRICE_CACHE_TIME_MS,
    gcTime: TOKEN_PRICE_CACHE_TIME_MS,
    ...options.query,
    queryKey: getTokenPriceQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getTokenPrice(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        chain: options.chain,
        tokenAddress: options.tokenAddress,
      }),
  };
}
