"use client";

import {
  createBinanceOrderbookSource,
  type BinanceOrderbookSourceParameters,
  type OrderbookSource,
} from "@symmio/trading-core";
import { useMemo } from "react";

/**
 * Parameters for {@link useBinanceOrderbookSource} — the same options
 * {@link createBinanceOrderbookSource} takes.
 */
export type UseBinanceOrderbookSourceParameters = BinanceOrderbookSourceParameters;

/**
 * Create a memoized Binance {@link OrderbookSource}.
 *
 * A source caches the venue's `exchangeInfo` for its lifetime, so recreating it
 * on every render would refetch that on every symbol resolve — and, worse, a
 * new source identity tears down and re-dials any live subscription built on
 * it. This hook keeps one instance alive for as long as its options are unchanged.
 *
 * `resolveSymbol` participates in the memo: pass a stable reference (module
 * scope, or your own `useCallback`) or the source is rebuilt each render.
 *
 * @param parameters - Market selection, endpoint overrides, and symbol mapping.
 * @returns A stable order-book source.
 *
 * @example
 * ```tsx
 * const source = useBinanceOrderbookSource();
 * const { orderbook } = useLiveOrderbook({ source, marketName: "BTCUSDT" });
 * ```
 */
export function useBinanceOrderbookSource(parameters: UseBinanceOrderbookSourceParameters = {}): OrderbookSource {
  const { market, restUrl, wsUrl, updateSpeed, resolveSymbol, webSocketConstructor } = parameters;

  return useMemo(
    () => createBinanceOrderbookSource({ market, restUrl, wsUrl, updateSpeed, resolveSymbol, webSocketConstructor }),
    [market, restUrl, wsUrl, updateSpeed, resolveSymbol, webSocketConstructor],
  );
}
