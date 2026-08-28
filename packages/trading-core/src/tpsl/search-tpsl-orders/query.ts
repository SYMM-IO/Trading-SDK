import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  searchTpSlOrders,
  type SearchTpSlOrdersParameters,
  type SearchTpSlOrdersReturnType,
} from "./search-tpsl-orders";

export type SearchTpSlOrdersData = SearchTpSlOrdersReturnType;

export function searchTpSlOrdersQueryKey(options: Compute<SearchTpSlOrdersParameters & ConfigKeyParameter>) {
  return ["searchTpSlOrders", filterQueryOptions(options)] as const;
}

export type SearchTpSlOrdersQueryKey = ReturnType<typeof searchTpSlOrdersQueryKey>;

export type SearchTpSlOrdersOptions = Compute<
  SearchTpSlOrdersParameters &
    QueryParameter<SearchTpSlOrdersData, Error, SearchTpSlOrdersData, SearchTpSlOrdersQueryKey>
>;

export type SearchTpSlOrdersQueryOptions = SymmioQueryOptions<
  SearchTpSlOrdersData,
  Error,
  SearchTpSlOrdersData,
  SearchTpSlOrdersQueryKey
>;

/**
 * Build TanStack Query options for {@link searchTpSlOrders}.
 *
 * Disabled until the search is scoped by **something** — an `account` or a
 * `symbolId`. Both are legitimate scopes: an account reads one trader's legs, a
 * `symbolId` reads one market's book across every trader. What stays disabled is
 * the unscoped case, which would sweep every order the handler holds.
 */
export function searchTpSlOrdersQueryOptions(
  config: Config,
  options: SearchTpSlOrdersOptions,
): SearchTpSlOrdersQueryOptions {
  return {
    ...options.query,
    queryKey: searchTpSlOrdersQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && (Boolean(options.account) || options.symbolId !== undefined),
    queryFn: () => searchTpSlOrders(config, options),
  };
}
