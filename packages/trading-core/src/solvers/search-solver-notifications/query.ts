import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  searchSolverNotifications,
  type SearchSolverNotificationsParameters,
  type SearchSolverNotificationsReturnType,
} from "./search-solver-notifications";

/** Data resolved by the {@link searchSolverNotificationsQueryOptions} query. */
export type SearchSolverNotificationsData = SearchSolverNotificationsReturnType;

/**
 * Build the TanStack Query key for {@link searchSolverNotificationsQueryOptions}.
 *
 * @param options - Query parameters (paging, filters, chain id, scope).
 * @returns A stable, hashable query key.
 */
export function searchSolverNotificationsQueryKey(
  options: Compute<SearchSolverNotificationsParameters & ConfigKeyParameter>,
) {
  return ["searchSolverNotifications", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link searchSolverNotificationsQueryKey}. */
export type SearchSolverNotificationsQueryKey = ReturnType<typeof searchSolverNotificationsQueryKey>;

/** Options accepted by {@link searchSolverNotificationsQueryOptions}. */
export type SearchSolverNotificationsOptions = Compute<
  SearchSolverNotificationsParameters &
    QueryParameter<
      SearchSolverNotificationsData,
      Error,
      SearchSolverNotificationsData,
      SearchSolverNotificationsQueryKey
    >
>;

/** TanStack Query options returned by {@link searchSolverNotificationsQueryOptions}. */
export type SearchSolverNotificationsQueryOptions = SymmioQueryOptions<
  SearchSolverNotificationsData,
  Error,
  SearchSolverNotificationsData,
  SearchSolverNotificationsQueryKey
>;

/**
 * Build TanStack Query options for {@link searchSolverNotifications}. A
 * non-rasa solver surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function searchSolverNotificationsQueryOptions(
  config: Config,
  options: SearchSolverNotificationsOptions,
): SearchSolverNotificationsQueryOptions {
  return {
    ...options.query,
    queryKey: searchSolverNotificationsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      searchSolverNotifications(config, {
        start: options.start,
        size: options.size,
        counterpartyAddress: options.counterpartyAddress,
        quoteId: options.quoteId,
        timestampGte: options.timestampGte,
        chainId: options.chainId,
        solverId: options.solverId,
      }),
  };
}
