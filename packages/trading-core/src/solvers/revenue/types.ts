/**
 * Trailing window a revenue read is scoped to.
 *
 * A closed set: the solver validates it and rejects anything else with
 * `TimeRange must be one of [1h 24h 7d 30d lifetime]`. `"lifetime"` is also the
 * default when the parameter is omitted.
 */
export type SolverRevenueTimeRange = "1h" | "24h" | "7d" | "30d" | "lifetime";

/**
 * Revenue totals for a window, split by where the revenue came from.
 *
 * Every figure is a plain `number` in the **dollar units the solver already
 * reports** — no decimal scaling (`165.49` means $165.49). `totalRevenue` is the
 * sum of {@link SolverRevenue.hedgerFeeRevenue} and
 * {@link SolverRevenue.fundingRevenue}.
 */
export interface SolverRevenue {
  /** Total revenue over the window (dollars). */
  totalRevenue: number;
  /** The share earned from hedger fees (dollars). */
  hedgerFeeRevenue: number;
  /** The share earned from funding payments (dollars). */
  fundingRevenue: number;
  /**
   * Number of underlying revenue rows behind the totals.
   *
   * Worth surfacing: it separates "the window genuinely earned nothing"
   * (`recordCount > 0`, totals `0`) from "there is no data for this window"
   * (`recordCount === 0`).
   */
  recordCount: number;
}
