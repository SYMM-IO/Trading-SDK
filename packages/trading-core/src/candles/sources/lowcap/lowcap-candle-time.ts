import { resolutionToMs } from "../../resolution";
import type { CandleResolution } from "../../types";

/** UTC bucket start; weeks start on Monday and months follow the calendar.
 *  @internal */
export function floorLowcapCandleTime(time: number, resolution: CandleResolution): number {
  const date = new Date(time);
  if (resolution === "1M") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (resolution === "1w") {
    const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return day - ((date.getUTCDay() + 6) % 7) * 86_400_000;
  }
  const interval = resolutionToMs(resolution);
  return Math.floor(time / interval) * interval;
}

/** Shift an aligned candle boundary, retaining variable calendar month lengths. @internal */
export function shiftLowcapCandleTime(time: number, resolution: CandleResolution, count: number): number {
  if (resolution === "1M") {
    const date = new Date(time);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1);
  }
  return time + resolutionToMs(resolution) * count;
}

/** First candle start at or after a requested time. @internal */
export function ceilLowcapCandleTime(time: number, resolution: CandleResolution): number {
  const start = floorLowcapCandleTime(time, resolution);
  return start === time ? start : shiftLowcapCandleTime(start, resolution, 1);
}
