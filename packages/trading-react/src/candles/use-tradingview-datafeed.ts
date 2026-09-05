"use client";

import {
  toTradingViewDatafeed,
  type CandleSource,
  type ToTradingViewDatafeedOptions,
  type TradingViewDatafeed,
} from "@symmio/trading-core";
import { useMemo } from "react";

/**
 * Parameters for {@link useTradingViewDatafeed}.
 */
export interface UseTradingViewDatafeedParameters extends ToTradingViewDatafeedOptions {
  /** The candle source the datafeed reads from. */
  source: CandleSource;
}

/**
 * Create a memoized TradingView datafeed over a {@link CandleSource}.
 *
 * The datafeed owns its live subscriptions, so it must outlive a render — a new
 * instance would orphan the sockets the chart is already holding. Keep the
 * `source` stable (see `useBinanceCandleSource`) and this stays stable too.
 *
 * @param parameters - Source plus symbol-header presentation overrides.
 * @returns A datafeed to pass straight to `widget({ datafeed })`.
 *
 * @example
 * ```tsx
 * const source = useBinanceCandleSource();
 * const datafeed = useTradingViewDatafeed({ source, exchange: "Binance" });
 *
 * useEffect(() => {
 *   const widget = new TradingView.widget({ datafeed, symbol: "BTCUSDT", interval: "60" });
 *   return () => widget.remove();
 * }, [datafeed]);
 * ```
 */
export function useTradingViewDatafeed(parameters: UseTradingViewDatafeedParameters): TradingViewDatafeed {
  const { source, exchange, session, timezone } = parameters;

  return useMemo(
    () => toTradingViewDatafeed(source, { exchange, session, timezone }),
    [source, exchange, session, timezone],
  );
}
