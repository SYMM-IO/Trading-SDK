/**
 * One day's trade volume for a solver market, normalized from the generated
 * `/trade-volume/{symbol_id}` response.
 *
 * Rows are daily buckets in ascending order. Both fields arrive from the solver
 * as strings and are surfaced as-is: the timestamp is an ISO 8601 datetime
 * string, the volume a decimal string kept unparsed to preserve precision.
 */
export interface SolverDailyVolume {
  /**
   * The day bucket, as the ISO 8601 datetime string the solver reports (e.g.
   * `"2026-07-09T00:00:00Z"`, midnight UTC on the bucket's day). getTradeVolume
   * omits rows with missing or invalid timestamps; direct toSolverDailyVolume
   * calls retain the empty-string fallback. Parse with `new Date(timestamp)` to render;
   * ISO 8601 also sorts correctly as a plain string.
   */
  timestamp: string;
  /** Decimal volume, unchanged. getTradeVolume omits missing values; direct mapper calls default them to "0". */
  volume: string;
}
