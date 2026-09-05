import type { Compute } from "../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../shared/types/query";
import { filterQueryOptions } from "../shared/utils/query";
import type { GetOrderbookParameters, Orderbook, OrderbookSource } from "./types";

/** Data resolved by the {@link getOrderbookQueryOptions} query. */
export type GetOrderbookData = Orderbook;

/**
 * The identifying half of {@link GetOrderbookOptions}: everything that decides
 * which book is being asked for.
 *
 * `signal` is excluded — cancellation is TanStack's concern, not part of the
 * request's identity.
 */
export type GetOrderbookQueryKeyParameters = Compute<
  Omit<GetOrderbookParameters, "signal"> & {
    /** {@link OrderbookSource.id}, so two sources never share a cache entry. */
    sourceId: string;
  }
>;

/**
 * Build the TanStack Query key for {@link getOrderbookQueryOptions}.
 *
 * @param options - Source id, market, and depth.
 * @returns A stable, hashable query key.
 */
export function getOrderbookQueryKey(options: GetOrderbookQueryKeyParameters) {
  return ["getOrderbook", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getOrderbookQueryKey}. */
export type GetOrderbookQueryKey = ReturnType<typeof getOrderbookQueryKey>;

/**
 * Options accepted by {@link getOrderbookQueryOptions}: the book to fetch plus
 * TanStack overrides.
 */
export type GetOrderbookOptions = Compute<
  Omit<GetOrderbookParameters, "signal"> &
    QueryParameter<GetOrderbookData, Error, GetOrderbookData, GetOrderbookQueryKey>
>;

/** TanStack Query options returned by {@link getOrderbookQueryOptions}. */
export type GetOrderbookQueryOptions = SymmioQueryOptions<
  GetOrderbookData,
  Error,
  GetOrderbookData,
  GetOrderbookQueryKey
>;

/**
 * Build TanStack Query options for an {@link OrderbookSource} snapshot.
 *
 * Unlike the chain-scoped factories in the SDK, this takes a source rather than
 * a `Config`: which venue's depth to read is the consumer's choice, not a
 * property of the SYMMIO deployment. The source's `id` is folded into the query
 * key so switching venues does not read another venue's cached book.
 *
 * A snapshot goes stale the moment it lands. For anything a user watches, use
 * `useLiveOrderbook` (or `watchOrderbook` directly) instead of polling this —
 * a synchronized diff stream is both fresher and far cheaper in rate-limit weight.
 *
 * @param source - The order-book source to read from.
 * @param options - Market, depth, and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getOrderbookQueryOptions(source, { marketName: "BTCUSDT", limit: 20 }));
 * ```
 */
export function getOrderbookQueryOptions(
  source: OrderbookSource,
  options: GetOrderbookOptions,
): GetOrderbookQueryOptions {
  const { marketName, limit } = options;

  return {
    ...options.query,
    queryKey: getOrderbookQueryKey({ sourceId: source.id, marketName, limit }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => source.getOrderbook({ marketName, limit }),
  };
}
