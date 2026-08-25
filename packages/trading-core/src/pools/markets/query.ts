import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getListingMarkets,
  type GetListingMarketsParameters,
  type GetListingMarketsReturnType,
} from "./get-listing-markets";

/** Data resolved by the {@link getListingMarketsQueryOptions} query. */
export type GetListingMarketsData = GetListingMarketsReturnType;

/**
 * Build the TanStack Query key for {@link getListingMarketsQueryOptions}.
 *
 * @param options - Search parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getListingMarketsQueryKey(options: Compute<GetListingMarketsParameters & ConfigKeyParameter>) {
  return ["getListingMarkets", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getListingMarketsQueryKey}. */
export type GetListingMarketsQueryKey = ReturnType<typeof getListingMarketsQueryKey>;

/**
 * Options accepted by {@link getListingMarketsQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetListingMarketsOptions = Compute<
  GetListingMarketsParameters &
    QueryParameter<GetListingMarketsData, Error, GetListingMarketsData, GetListingMarketsQueryKey>
>;

/** TanStack Query options returned by {@link getListingMarketsQueryOptions}. */
export type GetListingMarketsQueryOptions = SymmioQueryOptions<
  GetListingMarketsData,
  Error,
  GetListingMarketsData,
  GetListingMarketsQueryKey
>;

/**
 * Build TanStack Query options for {@link getListingMarkets}.
 *
 * @param config - The SDK config.
 * @param options - Search parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getListingMarketsQueryOptions(config, { sortBy: "tvl", limit: 50 }));
 * ```
 */
export function getListingMarketsQueryOptions(
  config: Config,
  options: GetListingMarketsOptions = {},
): GetListingMarketsQueryOptions {
  return {
    ...options.query,
    queryKey: getListingMarketsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getListingMarkets(config, {
        chainId: options.chainId,
        solverId: options.solverId,
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
