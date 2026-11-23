import { PriceTimeframe } from "../../../price-service/enigma/ohlcv/generated/enigma-price-service-ohlcv";
import type { CandleResolution } from "../../types";

const TIMEFRAME_BY_RESOLUTION: Partial<Record<CandleResolution, PriceTimeframe>> = {
  "1m": PriceTimeframe["1m"],
  "5m": PriceTimeframe["5m"],
  "10m": PriceTimeframe["10m"],
  "15m": PriceTimeframe["15m"],
  "30m": PriceTimeframe["30m"],
  "1h": PriceTimeframe["1h"],
  "4h": PriceTimeframe["4h"],
  "6h": PriceTimeframe["6h"],
  "12h": PriceTimeframe["12h"],
  "1d": PriceTimeframe["1D"],
  "1w": PriceTimeframe["1W"],
  "1M": PriceTimeframe["1M"],
};

/**
 * Map an SDK resolution to the price-service timeframe.
 * @param resolution - SDK bar size.
 * @returns The service code, or undefined when unsupported.
 * @internal
 */
export function toLowcapTimeframe(resolution: CandleResolution): PriceTimeframe | undefined {
  return TIMEFRAME_BY_RESOLUTION[resolution];
}

/**
 * List only the resolutions declared by the price service.
 * @returns A fresh list of supported SDK resolutions, shortest first.
 * @internal
 */
export function getLowcapSupportedResolutions(): CandleResolution[] {
  return Object.keys(TIMEFRAME_BY_RESOLUTION) as CandleResolution[];
}
