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
 * Build TanStack Query options for {@link searchTpSlOrders}. Disabled until
 * `account` is set — the handler filters by account, so a search without one
 * would sweep every order it holds.
 */
export function searchTpSlOrdersQueryOptions(
  config: Config,
  options: SearchTpSlOrdersOptions,
): SearchTpSlOrdersQueryOptions {
  return {
    ...options.query,
    queryKey: searchTpSlOrdersQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && Boolean(options.account),
    queryFn: () => searchTpSlOrders(config, options),
  };
}
