import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { hasEmptyListFilter } from "../../symmio-subgraph/subgraph-filters";
import type { QuoteEventType, QuoteSubgraphEventType } from "../get-quote-events-by-type/types";
import { toQuoteIdKeyPart } from "../quote-id-key-part";
import {
  getQuotesEventsByType,
  type GetQuotesEventsByTypeParameters,
  type GetQuotesEventsByTypeReturnType,
} from "./get-quotes-events-by-type";

/** Data resolved by the {@link getQuotesEventsByTypeQueryOptions} query. */
export type GetQuotesEventsByTypeData<TType extends QuoteSubgraphEventType = QuoteEventType> =
  GetQuotesEventsByTypeReturnType<TType>;

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
    {
      ...filtered,
      quoteIds: toQuoteIdKeyPart(options.quoteIds),
      ...(options.types === undefined ? {} : { types: [...options.types] }),
    },
  ] as const;
}

/** Query-key type produced by {@link getQuotesEventsByTypeQueryKey}. */
export type GetQuotesEventsByTypeQueryKey = ReturnType<typeof getQuotesEventsByTypeQueryKey>;

/**
 * Options accepted by {@link getQuotesEventsByTypeQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetQuotesEventsByTypeOptions<TType extends QuoteSubgraphEventType = QuoteSubgraphEventType> = Compute<
  GetQuotesEventsByTypeParameters<TType> &
    QueryParameter<
      GetQuotesEventsByTypeData<TType>,
      Error,
      GetQuotesEventsByTypeData<TType>,
      GetQuotesEventsByTypeQueryKey
    >
>;

/** TanStack Query options returned by {@link getQuotesEventsByTypeQueryOptions}. */
export type GetQuotesEventsByTypeQueryOptions<TType extends QuoteSubgraphEventType = QuoteEventType> =
  SymmioQueryOptions<
    GetQuotesEventsByTypeData<TType>,
    Error,
    GetQuotesEventsByTypeData<TType>,
    GetQuotesEventsByTypeQueryKey
  >;

/**
 * Build TanStack Query options for {@link getQuotesEventsByType}. The query is
 * disabled until at least one quote id is supplied, and while `types` is an
 * empty array; omitting `types` reads every type.
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
export function getQuotesEventsByTypeQueryOptions<TType extends QuoteSubgraphEventType = QuoteSubgraphEventType>(
  config: Config,
  options: GetQuotesEventsByTypeOptions<TType>,
): GetQuotesEventsByTypeQueryOptions<TType> {
  return {
    ...options.query,
    queryKey: getQuotesEventsByTypeQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && !hasEmptyListFilter(options.quoteIds, options.types),
    queryFn: () =>
      getQuotesEventsByType<TType>(config, {
        chainId: options.chainId,
        quoteIds: options.quoteIds,
        types: options.types,
        source: options.source,
        first: options.first,
        skip: options.skip,
        orderDirection: options.orderDirection,
      }),
  };
}
