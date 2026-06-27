import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getQuoteEventsByType,
  type GetQuoteEventsByTypeParameters,
  type GetQuoteEventsByTypeReturnType,
} from "./get-quote-events-by-type";

/** Data resolved by the {@link getQuoteEventsByTypeQueryOptions} query. */
export type GetQuoteEventsByTypeData = GetQuoteEventsByTypeReturnType;

/**
 * Build the TanStack Query key for {@link getQuoteEventsByTypeQueryOptions}.
 *
 * @param options - Query parameters (quote id, types, paging, sort, chain id, config key).
 * @returns A stable, hashable query key. The `bigint` quote id is stringified so
 *   the key is JSON-safe.
 */
export function getQuoteEventsByTypeQueryKey(options: Compute<GetQuoteEventsByTypeParameters & ConfigKeyParameter>) {
  const filtered = filterQueryOptions(options);
  return [
    "getQuoteEventsByType",
    { ...filtered, quoteId: options.quoteId.toString(), types: [...options.types] },
  ] as const;
}

/** Query-key type produced by {@link getQuoteEventsByTypeQueryKey}. */
export type GetQuoteEventsByTypeQueryKey = ReturnType<typeof getQuoteEventsByTypeQueryKey>;

/**
 * Options accepted by {@link getQuoteEventsByTypeQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetQuoteEventsByTypeOptions = Compute<
  GetQuoteEventsByTypeParameters &
    QueryParameter<GetQuoteEventsByTypeData, Error, GetQuoteEventsByTypeData, GetQuoteEventsByTypeQueryKey>
>;

/** TanStack Query options returned by {@link getQuoteEventsByTypeQueryOptions}. */
export type GetQuoteEventsByTypeQueryOptions = SymmioQueryOptions<
  GetQuoteEventsByTypeData,
  Error,
  GetQuoteEventsByTypeData,
  GetQuoteEventsByTypeQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuoteEventsByType}. The query is
 * disabled until at least one event type is supplied.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getQuoteEventsByTypeQueryOptions(config, { quoteId: 7334n, types: PRICE_HISTORY_EVENT_TYPES }),
 * );
 * ```
 */
export function getQuoteEventsByTypeQueryOptions(
  config: Config,
  options: GetQuoteEventsByTypeOptions,
): GetQuoteEventsByTypeQueryOptions {
  return {
    ...options.query,
    queryKey: getQuoteEventsByTypeQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.types.length > 0,
    queryFn: () =>
      getQuoteEventsByType(config, {
        chainId: options.chainId,
        quoteId: options.quoteId,
        types: options.types,
        first: options.first,
        skip: options.skip,
        orderDirection: options.orderDirection,
      }),
  };
}
