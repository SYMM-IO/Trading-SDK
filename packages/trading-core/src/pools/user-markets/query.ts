import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getUserListingMarkets,
  type GetUserListingMarketsParameters,
  type GetUserListingMarketsReturnType,
} from "./get-user-listing-markets";

/** Data resolved by the {@link getUserListingMarketsQueryOptions} query. */
export type GetUserListingMarketsData = GetUserListingMarketsReturnType;

/**
 * Build the TanStack Query key for {@link getUserListingMarketsQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension, so two calls that differ only by a
 * refreshed token still hit the same cache entry (and the token never leaks into
 * a devtools-visible key).
 *
 * @param options - Search parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getUserListingMarketsQueryKey(options: Compute<GetUserListingMarketsParameters & ConfigKeyParameter>) {
  return ["getUserListingMarkets", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getUserListingMarketsQueryKey}. */
export type GetUserListingMarketsQueryKey = ReturnType<typeof getUserListingMarketsQueryKey>;

/**
 * Options accepted by {@link getUserListingMarketsQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetUserListingMarketsOptions = Compute<
  GetUserListingMarketsParameters &
    QueryParameter<GetUserListingMarketsData, Error, GetUserListingMarketsData, GetUserListingMarketsQueryKey>
>;

/** TanStack Query options returned by {@link getUserListingMarketsQueryOptions}. */
export type GetUserListingMarketsQueryOptions = SymmioQueryOptions<
  GetUserListingMarketsData,
  Error,
  GetUserListingMarketsData,
  GetUserListingMarketsQueryKey
>;

/**
 * Build TanStack Query options for {@link getUserListingMarkets}.
 *
 * @param config - The SDK config.
 * @param options - Search parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getUserListingMarketsQueryOptions(config, { accessToken, sortBy: "tvl", limit: 50 }));
 * ```
 */
export function getUserListingMarketsQueryOptions(
  config: Config,
  options: GetUserListingMarketsOptions,
): GetUserListingMarketsQueryOptions {
  return {
    ...options.query,
    queryKey: getUserListingMarketsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getUserListingMarkets(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        accessToken: options.accessToken,
        search: options.search,
        chainIds: options.chainIds,
        marketStatus: options.marketStatus,
        limit: options.limit,
        offset: options.offset,
        sortBy: options.sortBy,
        orderBy: options.orderBy,
        filters: options.filters,
      }),
  };
}
