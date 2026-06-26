import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  searchNotifications,
  type SearchNotificationsParameters,
  type SearchNotificationsReturnType,
} from "./search-notifications";

/** Data resolved by the {@link searchNotificationsQueryOptions} query. */
export type SearchNotificationsData = SearchNotificationsReturnType;

/**
 * Build the TanStack Query key for {@link searchNotificationsQueryOptions}.
 *
 * The `filter` object is folded into the key, so two searches with different
 * filters cache independently; TanStack control fields (`query`) are stripped.
 *
 * @param options - Search parameters (filter, pagination, chain id, config key).
 * @returns A stable, hashable query key.
 */
export function searchNotificationsQueryKey(
  options: Compute<ExactPartial<SearchNotificationsParameters> & ConfigKeyParameter> = {},
) {
  return ["searchNotifications", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link searchNotificationsQueryKey}. */
export type SearchNotificationsQueryKey = ReturnType<typeof searchNotificationsQueryKey>;

/**
 * Options accepted by {@link searchNotificationsQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides (`query`).
 */
export type SearchNotificationsOptions = Compute<
  SearchNotificationsParameters &
    QueryParameter<SearchNotificationsData, Error, SearchNotificationsData, SearchNotificationsQueryKey>
>;

/** TanStack Query options returned by {@link searchNotificationsQueryOptions}. */
export type SearchNotificationsQueryOptions = SymmioQueryOptions<
  SearchNotificationsData,
  Error,
  SearchNotificationsData,
  SearchNotificationsQueryKey
>;

/**
 * Build TanStack Query options for {@link searchNotifications}. The query is
 * disabled until `filter` has at least one key (so an empty filter never fires
 * a match-all request); pass `query.refetchInterval` to poll.
 *
 * @param config - The SDK config.
 * @param options - Search parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   searchNotificationsQueryOptions(config, {
 *     filter: { "data.temp_quote_id": -172 },
 *     query: { refetchInterval: 5_000 },
 *   }),
 * );
 * ```
 */
export function searchNotificationsQueryOptions(
  config: Config,
  options: SearchNotificationsOptions,
): SearchNotificationsQueryOptions {
  const hasFilter = options.filter != null && Object.keys(options.filter).length > 0;
  return {
    ...options.query,
    queryKey: searchNotificationsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: hasFilter && (options.query?.enabled ?? true),
    queryFn: () =>
      searchNotifications(config, {
        chainId: options.chainId,
        filter: options.filter,
        size: options.size,
        start: options.start,
        baseUrl: options.baseUrl,
      }),
  };
}
