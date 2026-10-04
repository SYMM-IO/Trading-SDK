/**
 * Market metadata resolved by {@link resolveMarket}.
 *
 * Lives in `solvers/shared/resolvers/` because both the instant-open and the
 * instant-close wizards depend on it. Move slice-specific types back into
 * their own slice's resolvers folder; only types shared by ≥2 slices belong
 * here.
 */
export interface ResolvedMarket {
  name: string;
  pricePrecision: number;
  quantityPrecision: number;
  /** Present when resolved with `includeSolverFeeCaps`. Decimal ratio string; `"0"` for kinds without caps. */
  minOpenSolverFeeCap?: string;
  /** Present when resolved with `includeSolverFeeCaps`. Decimal ratio string; `"0"` for kinds without caps. */
  minCloseSolverFeeCap?: string;
  /** Present when resolved with `includeHedgerFees`. Solver open-fee rate, decimal fraction string. */
  hedgerFeeOpen?: string;
  /** Present when resolved with `includeHedgerFees`. Solver standard (floor) close-fee rate, decimal fraction string. */
  hedgerFeeClose?: string;
  /** Present when resolved with `includeHedgerFees` on an Enigma market. Early (peak) close-fee rate, decimal fraction string. */
  hedgerFeeCloseEarlyRate?: string;
  /** Present when resolved with `includeHedgerFees` on an Enigma market. Early-window length in seconds. */
  hedgerFeeCloseEarlyThreshold?: number;
  /** Present when resolved with `includeHedgerFees` on an Enigma market. Standard-rate threshold in seconds. */
  hedgerFeeCloseStandardThreshold?: number;
  /** Present when resolved with `includeQuoteConstraints`. Minimum `lf / (cva + lf + partyAmm)` portion (decimal fraction). */
  minAcceptablePortionLf?: string;
  /** Present when resolved with `includeQuoteConstraints`. Minimum locked-margin sum (decimal string). */
  minAcceptableQuoteValue?: string;
  /** Present when resolved with `includeQuoteConstraints`. Maximum notional position value; `0` ⇒ unpublished. */
  maxNotionalValue?: number;
  /** Present when resolved with `includeQuoteConstraints`. Minimum notional position value (decimal string). */
  minNotionalValue?: string;
  /** Present when resolved with `includeQuoteConstraints`. Maximum order quantity (decimal string); `"0"` ⇒ unpublished. */
  maxQuantity?: string;
  /** Present when resolved with `includeQuoteConstraints`. Minimum tradable increment / lot size (decimal string). */
  lotSize?: string;
}
