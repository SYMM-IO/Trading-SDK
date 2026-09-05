"use client";

import { createBinanceCandleSource, type BinanceCandleSourceParameters, type CandleSource } from "@symmio/trading-core";
import { useMemo } from "react";

/**
 * Parameters for {@link useBinanceCandleSource} — the same options
 * {@link createBinanceCandleSource} takes.
 */
export type UseBinanceCandleSourceParameters = BinanceCandleSourceParameters;

/**
 * Create a memoized Binance {@link CandleSource}.
 *
 * A source caches the venue's `exchangeInfo` for its lifetime, so recreating it
 * on every render would refetch that on every symbol resolve. This hook keeps
 * one instance alive for as long as its options are unchanged.
 *
 * `resolveSymbol` participates in the memo: pass a stable reference (module
 * scope, or your own `useCallback`) or the source is rebuilt each render.
 *
 * @param parameters - Market selection, endpoint overrides, and symbol mapping.
 * @returns A stable candle source.
 *
 * @example
 * ```tsx
 * const source = useBinanceCandleSource();
 * const { data } = useCandles({ source, marketName: "BTCUSDT", resolution: "1m", from, to });
 * ```
 */
export function useBinanceCandleSource(parameters: UseBinanceCandleSourceParameters = {}): CandleSource {
  const { market, restUrl, wsUrl, resolveSymbol, webSocketConstructor } = parameters;

  return useMemo(
    () => createBinanceCandleSource({ market, restUrl, wsUrl, resolveSymbol, webSocketConstructor }),
    [market, restUrl, wsUrl, resolveSymbol, webSocketConstructor],
  );
}
