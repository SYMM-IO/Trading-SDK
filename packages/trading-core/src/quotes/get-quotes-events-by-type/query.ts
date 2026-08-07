import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getQuotesEventsByType,
  type GetQuotesEventsByTypeParameters,
  type GetQuotesEventsByTypeReturnType,
} from "./get-quotes-events-by-type";

/** Data resolved by the {@link getQuotesEventsByTypeQueryOptions} query. */
export type GetQuotesEventsByTypeData = GetQuotesEventsByTypeReturnType;

/**
 * Stringify the quote ids for the query key, sorted ascending so that two calls
 * that pass the same ids in a different order share one cache entry. Sorts a
 * copy — the caller's array is never mutated.
 */
function toQuoteIdKeyPart(quoteIds: readonly bigint[]): string[] {
  return [...quoteIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((id) => id.toString());
}

/**
 * Build the TanStack Query key for {@link getQuotesEventsByTypeQueryOptions}.
 *
 * @param options - Query parameters (quote ids, types, paging, sort, chain id, config key).
 * @returns A stable, hashable query key. The `bigint` quote ids are stringified so
 *   the key is JSON-safe, and sorted so id order does not fragment the cache.
 */
export function getQuotesEventsByTypeQueryKey(options: Compute<GetQuotesEventsByTypeParameters & ConfigKeyParameter>) {
  const filtered = filterQueryOptions(options);
  return [
    "getQuotesEventsByType",
    { ...filtered, quoteIds: toQuoteIdKeyPart(options.quoteIds), types: [...options.types] },
  ] as const;
}

/** Query-key type produced by {@link getQuotesEventsByTypeQueryKey}. */
export type GetQuotesEventsByTypeQueryKey = ReturnType<typeof getQuotesEventsByTypeQueryKey>;

/**
 * Options accepted by {@link getQuotesEventsByTypeQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetQuotesEventsByTypeOptions = Compute<
  GetQuotesEventsByTypeParameters &
    QueryParameter<GetQuotesEventsByTypeData, Error, GetQuotesEventsByTypeData, GetQuotesEventsByTypeQueryKey>
>;

/** TanStack Query options returned by {@link getQuotesEventsByTypeQueryOptions}. */
export type GetQuotesEventsByTypeQueryOptions = SymmioQueryOptions<
  GetQuotesEventsByTypeData,
  Error,
  GetQuotesEventsByTypeData,
  GetQuotesEventsByTypeQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuotesEventsByType}. The query is
 * disabled until at least one quote id **and** one event type are supplied.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getQuotesEventsByTypeQueryOptions(config, {
 *     quoteIds: [7334n, 7335n],
 *     types: FUNDING_HISTORY_EVENT_TYPES,
 *   }),
 * );
 * ```
 */
export function getQuotesEventsByTypeQueryOptions(
  config: Config,
  options: GetQuotesEventsByTypeOptions,
): GetQuotesEventsByTypeQueryOptions {
  return {
    ...options.query,
    queryKey: getQuotesEventsByTypeQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.quoteIds.length > 0 && options.types.length > 0,
    queryFn: () =>
      getQuotesEventsByType(config, {
        chainId: options.chainId,
        quoteIds: options.quoteIds,
        types: options.types,
        first: options.first,
        skip: options.skip,
        orderDirection: options.orderDirection,
      }),
  };
}
