import type { CandleResolution } from "../../types";
import type { BinanceMarket } from "./constants";

/**
 * Resolutions both Binance markets serve, mapped to their `interval` strings.
 *
 * The codes happen to be identical to the SDK's own vocabulary for this range,
 * but the mapping is written out rather than assumed — the SDK's resolution set
 * is its own contract, and a venue that names things differently plugs in the
 * same way.
 */
const SHARED_INTERVALS: Partial<Record<CandleResolution, string>> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "6h": "6h",
  "8h": "8h",
  "12h": "12h",
  "1d": "1d",
  "3d": "3d",
  "1w": "1w",
  "1M": "1M",
};

/**
 * Per-market interval tables.
 *
 * Spot additionally serves `1s` klines. USD-M futures does not, and neither
 * market has any equivalent of the SDK's `10s` bucket — a source that needs
 * sub-minute bars for a perp has to build them by folding a tick stream, which
 * is a different source entirely.
 */
const INTERVALS: Record<BinanceMarket, Partial<Record<CandleResolution, string>>> = {
  "usd-m-futures": SHARED_INTERVALS,
  spot: { "1s": "1s", ...SHARED_INTERVALS },
};

/**
 * Translate an SDK resolution into a Binance `interval` string.
 *
 * @param market - Which Binance market the interval is for.
 * @param resolution - The SDK resolution to translate.
 * @returns The Binance interval, or `undefined` when that market has no
 *   equivalent bucket.
 *
 * @example
 * ```ts
 * toBinanceInterval("usd-m-futures", "4h"); // "4h"
 * toBinanceInterval("usd-m-futures", "1s"); // undefined — futures has no 1s klines
 * ```
 */
export function toBinanceInterval(market: BinanceMarket, resolution: CandleResolution): string | undefined {
  return INTERVALS[market][resolution];
}

/**
 * List the resolutions a Binance market can serve, in ascending bar size.
 *
 * @param market - Which Binance market to describe.
 * @returns The supported resolutions, suitable for `CandleSource.supportedResolutions`.
 */
export function getBinanceSupportedResolutions(market: BinanceMarket): readonly CandleResolution[] {
  return Object.keys(INTERVALS[market]) as CandleResolution[];
}
