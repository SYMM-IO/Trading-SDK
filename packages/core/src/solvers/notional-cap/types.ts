/**
 * Available-liquidity figures for one solver market, normalized from the
 * generated `/notional_cap/{symbolId}` response.
 *
 * Every numeric field is a plain JavaScript `number` in the **dollar units the
 * solver already reports** — no decimal scaling. `1234` here means $1,234.
 *
 * The solver may include an `error` string in the raw payload; the SDK
 * surfaces it on this object rather than throwing, so the caller can decide
 * whether a partial response is still usable. When `error` is non-empty, the
 * numeric fields may be missing or zero.
 */
export interface MarketNotionalCap {
  /** Solver market id (`symbol_id`). */
  symbolId: number;
  /** Market ticker (`symbol`). */
  symbol: string;
  /** Total notional cap configured for the market (dollars). */
  totalCap: number;
  /** Notional already used across both sides (dollars). */
  used: number;
  /** Notional the solver will still accept on the long side (dollars). */
  availableToLong: number;
  /** Notional the solver will still accept on the short side (dollars). */
  availableToShort: number;
  /** Net open interest on the market (dollars). */
  openInterest: number;
  /** Solver-reported reference price (dollars). */
  price: number;
  /** Solver token balance backing the market (dollars). */
  tokenBalance: number;
  /** Solver USDC balance backing the market (dollars). */
  usdcBalance: number;
  /** Solver-reported error string for this market, or `null` when none. */
  error: string | null;
}
