import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  searchPositionStates,
  type SearchPositionStatesParameters,
  type SearchPositionStatesReturnType,
} from "./search-position-states";

/** Data resolved by the {@link searchPositionStatesQueryOptions} query. */
export type SearchPositionStatesData = SearchPositionStatesReturnType;

/**
 * Build the TanStack Query key for {@link searchPositionStatesQueryOptions}.
 *
 * @param options - Query parameters (paging, filters, chain id, scope).
 * @returns A stable, hashable query key.
 */
export function searchPositionStatesQueryKey(options: Compute<SearchPositionStatesParameters & ConfigKeyParameter>) {
  return ["searchPositionStates", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link searchPositionStatesQueryKey}. */
export type SearchPositionStatesQueryKey = ReturnType<typeof searchPositionStatesQueryKey>;

/** Options accepted by {@link searchPositionStatesQueryOptions}. */
export type SearchPositionStatesOptions = Compute<
  SearchPositionStatesParameters &
    QueryParameter<SearchPositionStatesData, Error, SearchPositionStatesData, SearchPositionStatesQueryKey>
>;

/** TanStack Query options returned by {@link searchPositionStatesQueryOptions}. */
export type SearchPositionStatesQueryOptions = SymmioQueryOptions<
  SearchPositionStatesData,
  Error,
  SearchPositionStatesData,
  SearchPositionStatesQueryKey
>;

/**
 * Build TanStack Query options for {@link searchPositionStates}. A non-rasa
 * solver surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function searchPositionStatesQueryOptions(
  config: Config,
  options: SearchPositionStatesOptions,
): SearchPositionStatesQueryOptions {
  return {
    ...options.query,
    queryKey: searchPositionStatesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      searchPositionStates(config, {
        start: options.start,
        size: options.size,
        address: options.address,
        quoteId: options.quoteId,
        createTimeGte: options.createTimeGte,
        modifyTimeGte: options.modifyTimeGte,
        chainId: options.chainId,
        solverId: options.solverId,
      }),
  };
}
