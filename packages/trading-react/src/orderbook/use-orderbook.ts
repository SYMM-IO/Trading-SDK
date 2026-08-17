"use client";

import {
  getOrderbookQueryOptions,
  type GetOrderbookOptions,
  type Orderbook,
  type OrderbookSource,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Parameters for {@link useOrderbook}: the source to read from, the book to
 * fetch, and TanStack `query` overrides.
 */
export type UseOrderbookParameters = GetOrderbookOptions & {
  /** The order-book source to read from, e.g. from {@link useBinanceOrderbookSource}. */
  source: OrderbookSource;
};

/** Return type of {@link useOrderbook}. */
export type UseOrderbookReturnType = UseQueryResult<Orderbook, SymmioRequestError>;

/**
 * Fetch a point-in-time order-book snapshot from an {@link OrderbookSource}.
 *
 * The source's `id` is part of the query key, so switching venues does not read
 * another venue's cached book.
 *
 * A snapshot is stale the moment it lands. Use this for a one-off read — sizing
 * a single order, an impact estimate, a server-rendered summary. For anything a
 * user watches, use `useLiveOrderbook`: a synchronized diff stream is fresher
 * than any poll interval and costs a fraction of the venue's rate-limit weight.
 *
 * @param parameters - Source, market, depth, and query overrides.
 * @returns A TanStack query result carrying the book.
 *
 * @example
 * ```tsx
 * const source = useBinanceOrderbookSource();
 * const { data, isLoading } = useOrderbook({ source, marketName: "BTCUSDT", limit: 20 });
 * ```
 */
export function useOrderbook(parameters: UseOrderbookParameters): UseOrderbookReturnType {
  const { source, ...options } = parameters;
  const queryOptions = getOrderbookQueryOptions(source, options);

  return useQuery({
    ...queryOptions,
    queryFn: async () => {
      try {
        return await queryOptions.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseOrderbookReturnType;
}
