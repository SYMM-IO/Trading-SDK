import type { BarChartBucket } from "@symmio/ui/components/bar-chart";

/** The solver's daily-volume row shape, as `useTradeVolume` returns it. */
interface DailyVolumeRow {
  /** ISO 8601 day bucket, e.g. `"2026-07-09T00:00:00Z"`; empty when the solver omitted it. */
  timestamp: string;
  /** Notional traded that day, as the solver's decimal string. */
  volume: string;
}

/**
 * The solver's daily-volume rows as chart buckets: ISO day stamps become
 * milliseconds, decimal strings become numbers, and any row the solver failed
 * to stamp is dropped rather than plotted at `NaN`.
 */
export function toVolumeBuckets(rows: readonly DailyVolumeRow[] | undefined): BarChartBucket[] {
  return (rows ?? [])
    .map((row) => ({ x: Date.parse(row.timestamp), values: [Number(row.volume) || 0] }))
    .filter((bucket) => Number.isFinite(bucket.x))
    .sort((a, b) => a.x - b.x);
}
