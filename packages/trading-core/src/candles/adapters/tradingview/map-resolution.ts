import type { CandleResolution } from "../../types";

/**
 * TradingView resolution code → SDK {@link CandleResolution}.
 *
 * TradingView encodes intraday resolutions as bare minute counts (`"60"` is one
 * hour), seconds with an `S` suffix, and days/weeks/months with a letter. The
 * bare-letter forms (`"D"`, `"W"`, `"M"`) are accepted alongside the numbered
 * ones because the library emits both depending on how the chart was configured.
 */
const FROM_TRADINGVIEW: Record<string, CandleResolution> = {
  "1S": "1s",
  "10S": "10s",
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
  "360": "6h",
  "480": "8h",
  "720": "12h",
  D: "1d",
  "1D": "1d",
  "3D": "3d",
  W: "1w",
  "1W": "1w",
  M: "1M",
  "1M": "1M",
};

/**
 * SDK {@link CandleResolution} → the TradingView code to advertise for it.
 *
 * The inverse of {@link FROM_TRADINGVIEW}, but not derived from it: that map is
 * intentionally many-to-one (`"D"` and `"1D"` both mean a day) and only one
 * spelling should appear in `supported_resolutions`.
 */
const TO_TRADINGVIEW: Record<CandleResolution, string> = {
  "1s": "1S",
  "10s": "10S",
  "1m": "1",
  "3m": "3",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "2h": "120",
  "4h": "240",
  "6h": "360",
  "8h": "480",
  "12h": "720",
  "1d": "1D",
  "3d": "3D",
  "1w": "1W",
  "1M": "1M",
};

/**
 * Translate a TradingView resolution code into an SDK resolution.
 *
 * @param resolution - The code the charting library passed (e.g. `"240"`).
 * @returns The SDK resolution, or `undefined` when the code is unrecognized.
 *
 * @example
 * ```ts
 * fromTradingViewResolution("60"); // "1h"
 * ```
 */
export function fromTradingViewResolution(resolution: string): CandleResolution | undefined {
  return FROM_TRADINGVIEW[resolution];
}

/**
 * Translate an SDK resolution into the TradingView code to advertise for it.
 *
 * @param resolution - The SDK resolution.
 * @returns The TradingView code (e.g. `"1h"` → `"60"`).
 *
 * @example
 * ```ts
 * toTradingViewResolution("1h"); // "60"
 * ```
 */
export function toTradingViewResolution(resolution: CandleResolution): string {
  return TO_TRADINGVIEW[resolution];
}
