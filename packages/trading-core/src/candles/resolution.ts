import { SymmError } from "../shared/errors/symm-error";
import type { CandleResolution } from "./types";

/**
 * Nominal length of each {@link CandleResolution} in milliseconds.
 *
 * `1w` and `1M` are calendar units — a month is not a fixed span. The values
 * here use nominal 7-day and 30-day lengths for estimating a request's span.
 * Do not use the nominal month length for calendar alignment or lossless
 * time-window pagination. Those require the source's calendar rules.
 */
export const CANDLE_RESOLUTION_MS: Record<CandleResolution, number> = {
  "1s": 1_000,
  "10s": 10_000,
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "10m": 600_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "6h": 21_600_000,
  "8h": 28_800_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "3d": 259_200_000,
  "1w": 604_800_000,
  "1M": 2_592_000_000,
};

/**
 * Nominal length of a resolution in milliseconds.
 *
 * @param resolution - The resolution to measure.
 * @returns Its nominal length in ms. See {@link CANDLE_RESOLUTION_MS} for the
 *   caveat on calendar units.
 * @throws {SymmError} when the resolution is not a known {@link CandleResolution}.
 *
 * @example
 * ```ts
 * resolutionToMs("5m"); // 300_000
 * ```
 */
export function resolutionToMs(resolution: CandleResolution): number {
  const ms = CANDLE_RESOLUTION_MS[resolution];
  if (ms === undefined) {
    throw new SymmError("validation", "UNKNOWN_CANDLE_RESOLUTION", `Unknown candle resolution: "${resolution}".`);
  }
  return ms;
}
