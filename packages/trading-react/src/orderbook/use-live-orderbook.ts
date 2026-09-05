"use client";

import {
  accumulateOrderbook,
  getOrderbookSpread,
  groupOrderbook,
  suggestOrderbookTickSizes,
  type Orderbook,
  type OrderbookDepthLevel,
  type OrderbookResyncReason,
  type OrderbookSource,
  type OrderbookSpread,
  type OrderbookSymbol,
  type SocketStatus,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useOrderbookStream } from "./use-orderbook-stream";

/**
 * Level budgets the subscription rounds up to.
 *
 * Quantized on purpose: `levels` is a subscription parameter, so recomputing it
 * exactly would re-dial the socket and refetch a snapshot every time the
 * grouping nudged. Rounding into a handful of buckets means only a real jump in
 * appetite costs a resubscribe.
 */
const LEVEL_BUDGETS = [100, 250, 500, 1000] as const;

/**
 * Ceiling on the derived budget.
 *
 * Past this the venue's own snapshot depth becomes the binding constraint, so
 * asking for more buys nothing but per-tick allocation.
 */
const MAX_LEVEL_BUDGET = 1000;

/**
 * Levels to stream so that `rows` rows can actually be filled after grouping.
 *
 * The naive product (`rows × groupingRatio`) assumes every venue tick is
 * occupied. Real books thin out away from the touch, so the estimate carries
 * headroom — without it a coarse grouping starves the ladder and it renders
 * half-empty.
 */
function resolveLevelBudget(rows: number, groupingRatio: number): number {
  const needed = Math.ceil(rows * groupingRatio * 1.5);
  return LEVEL_BUDGETS.find((budget) => budget >= needed) ?? MAX_LEVEL_BUDGET;
}

/**
 * Parameters for {@link useLiveOrderbook}.
 */
export interface UseLiveOrderbookParameters {
  /** The order-book source to stream from. */
  source: OrderbookSource;
  /** Market name as SYMMIO names it. */
  marketName: string;
  /** Snapshot depth the live book is built on. Defaults to the source's own default. */
  limit?: number;
  /**
   * Levels per side to receive before grouping.
   *
   * Derived from `rows` and the active grouping by default, and normally best
   * left alone: grouping collapses levels, so a fixed budget that fills the
   * ladder at the venue tick starves it at ten times that tick. Set it only to
   * cap the per-update cost deliberately, accepting that a coarse grouping may
   * then render fewer than `rows` rows.
   */
  levels?: number;
  /**
   * Rows per side to return after grouping. Defaults to `15`.
   *
   * Both sides get the same budget, so `rows: 5` yields five bids and five asks.
   */
  rows?: number;
  /**
   * Price grouping. Defaults to the venue's own tick size, i.e. no grouping.
   *
   * Pick from {@link UseLiveOrderbookReturnType.tickSizeOptions} to keep a
   * selector's choices to groupings the venue can actually quote.
   */
  tickSize?: number;
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
}

/**
 * Value returned by {@link useLiveOrderbook}.
 */
export interface UseLiveOrderbookReturnType {
  /** Grouped bid rows with cumulative depth, best price first. */
  bids: OrderbookDepthLevel[];
  /** Grouped ask rows with cumulative depth, best price first. */
  asks: OrderbookDepthLevel[];
  /** Best prices and the gap between them, from the **ungrouped** book. */
  spread: OrderbookSpread | undefined;
  /**
   * Largest cumulative total across both returned sides.
   *
   * Normalize depth bars against this so the two sides share one scale and a
   * thin side reads as thin rather than being stretched to fill its column.
   */
  maxTotal: number;
  /** Symbol metadata: assets, precisions, and the venue tick. */
  symbol: OrderbookSymbol | undefined;
  /** The grouping actually applied, or `undefined` before the symbol resolves. */
  tickSize: number | undefined;
  /** Groupings worth offering in a selector, ascending from the venue tick. */
  tickSizeOptions: number[];
  /** The raw ungrouped book, for callers that want to do their own aggregation. */
  orderbook: Orderbook | null;
  /** `true` while the book is being rebuilt; the returned rows are the last good ones. */
  isResyncing: boolean;
  /** Why the current or most recent rebuild happened. */
  resyncReason: OrderbookResyncReason | null;
  /** `true` until the first book arrives. */
  isLoading: boolean;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport, parse, or snapshot error, normalized, or `null`. */
  error: SymmioRequestError | null;
  /** `true` when the source does not carry this market. */
  isUnsupported: boolean;
}

/**
 * A ladder-ready order book: synchronized, grouped, and accumulated.
 *
 * This is the hook most consumers want. It resolves the market's symbol
 * metadata, holds one synchronized subscription, collapses the book onto the
 * requested tick, attaches cumulative depth to every row, and reports the
 * spread from the ungrouped book — grouping moves the touch prices, so a
 * spread read off grouped rows would overstate it by up to two ticks.
 *
 * Drop to `useOrderbookStream` when you want the raw synchronized book, or to
 * `useOrderbook` for a one-off snapshot.
 *
 * @param parameters - Source, market, depth, grouping, and row count.
 * @returns Rows, spread, symbol metadata, and connection state.
 *
 * @example
 * ```tsx
 * const source = useBinanceOrderbookSource();
 * const { bids, asks, spread, maxTotal, tickSizeOptions } = useLiveOrderbook({
 *   source,
 *   marketName: "BTCUSDT",
 *   tickSize: 0.1,
 *   rows: 15,
 * });
 * ```
 */
export function useLiveOrderbook(parameters: UseLiveOrderbookParameters): UseLiveOrderbookReturnType {
  const { source, marketName, limit, levels, rows = 15, tickSize, enabled = true } = parameters;

  const symbolQuery = useQuery({
    queryKey: ["orderbookSymbol", source.id, marketName],
    queryFn: async () => {
      try {
        /** `undefined` means "not listed here", which TanStack cannot cache — `null` can. */
        return (await source.getSymbol(marketName)) ?? null;
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    /** Listings change on a delisting, not on a render. */
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  });

  const symbol = symbolQuery.data ?? undefined;
  const isUnsupported = symbolQuery.data === null;

  /**
   * Streaming waits for the listing check to land. Dialing first and tearing
   * down once the answer arrives costs a wasted socket and a snapshot request
   * that the venue rejects outright for a market it does not list.
   *
   * A failed check fails **open**: a transient metadata error should not stand
   * between a listed market and its book.
   */
  const isListingKnown = symbolQuery.isSuccess || symbolQuery.isError;

  const appliedTickSize = tickSize ?? symbol?.tickSize;

  /**
   * How many venue ticks one rendered row spans. Grouping at ten times the
   * venue tick means each row swallows up to ten levels, so the ladder needs
   * roughly ten times as many of them to fill the same number of rows.
   */
  const groupingRatio =
    symbol && appliedTickSize && symbol.tickSize > 0 ? Math.max(1, appliedTickSize / symbol.tickSize) : 1;

  const streamLevels = levels ?? resolveLevelBudget(rows, groupingRatio);

  const stream = useOrderbookStream({
    source,
    marketName,
    limit,
    levels: streamLevels,
    enabled: enabled && isListingKnown && !isUnsupported,
  });

  const spread = useMemo(
    () => (stream.orderbook ? getOrderbookSpread(stream.orderbook) : undefined),
    [stream.orderbook],
  );

  /**
   * The ladder is scaled against the price's order of magnitude, not its live
   * mid. Recomputing on every tick would hand a selector a new array of
   * options several times a second, for a list that should look fixed.
   */
  const referencePrice = spread ? Number(spread.midPrice.toPrecision(2)) : undefined;

  const tickSizeOptions = useMemo(
    () => (symbol && referencePrice ? suggestOrderbookTickSizes(symbol.tickSize, referencePrice) : []),
    [symbol, referencePrice],
  );

  const { bids, asks, maxTotal } = useMemo(() => {
    if (!stream.orderbook) return { bids: [], asks: [], maxTotal: 0 };

    const grouped =
      appliedTickSize && appliedTickSize > 0 ? groupOrderbook(stream.orderbook, appliedTickSize) : stream.orderbook;

    const groupedBids = accumulateOrderbook(grouped.bids).slice(0, rows);
    const groupedAsks = accumulateOrderbook(grouped.asks).slice(0, rows);

    return {
      bids: groupedBids,
      asks: groupedAsks,
      /** Both sides share one scale, so a thin side reads as thin. */
      maxTotal: Math.max(groupedBids.at(-1)?.total ?? 0, groupedAsks.at(-1)?.total ?? 0),
    };
  }, [stream.orderbook, appliedTickSize, rows]);

  return {
    bids,
    asks,
    spread,
    maxTotal,
    symbol,
    tickSize: appliedTickSize,
    tickSizeOptions,
    orderbook: stream.orderbook,
    isResyncing: stream.isResyncing,
    resyncReason: stream.resyncReason,
    isLoading: enabled && !isUnsupported && stream.orderbook === null && stream.error === null && !symbolQuery.isError,
    status: stream.status,
    error: stream.error ?? (symbolQuery.error as SymmioRequestError | null) ?? null,
    isUnsupported,
  };
}
