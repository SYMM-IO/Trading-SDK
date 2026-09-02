/**
 * Long/short-side state filter accepted by {@link GetSymbolsParameters}. Mirrors
 * the solver's `/symbols` `state_long` / `state_short` query values.
 */
export type SymbolStateFilter = "disabled" | "close_only" | "open_only" | "enabled";

/**
 * Validity filter accepted by {@link GetSymbolsParameters}. The solver defaults
 * to `"true"` (valid symbols only); pass `"any"` to include invalid ones.
 */
export type SymbolValidityFilter = "true" | "false" | "any";

/**
 * One symbol from the Enigma solver's `/symbols` endpoint, normalized from the
 * generated `ApiSymbolResponse` into a stable camelCase SDK shape.
 *
 * Distinct from {@link Market} (the `/contract-symbols` shape): `/symbols` is a
 * paginated, filterable catalogue that reports **per-side** trading state
 * ({@link SolverSymbol.stateLong} / {@link SolverSymbol.stateShort}) instead of
 * the single `state`/`side` pair `/contract-symbols` returns. Treat the two as
 * different endpoints — do not substitute one for the other.
 */
export interface SolverSymbol {
  /** Numeric symbol id, e.g. `1`. */
  symbolId: number;
  /** Display name, e.g. `"BTCUSDT"`. */
  name: string;
  /** Ticker, e.g. `"BTC"`. */
  symbol: string;
  /** Base asset, e.g. `"BTC"`. */
  asset: string;
  /** Whether the symbol is currently valid/known to the solver. */
  isValid: boolean;
  /** Price display precision (decimal places). */
  pricePrecision: number;
  /** Quantity display precision (decimal places). */
  quantityPrecision: number;
  /** Maximum leverage. Coerced to a number (the solver returns it as a string). */
  maxLeverage: number;
  /** Maximum notional position value. */
  maxNotionalValue: number;
  /** Whether RFQ (instant-open) is allowed for this symbol. */
  rfqAllowed: boolean;
  /** Trading fee, as a decimal string (kept a string to avoid float loss). */
  tradingFee: string;
  /** Hedger fee charged on open, as a decimal string. */
  hedgerFeeOpen: string;
  /** Hedger fee charged on close, as a decimal string. */
  hedgerFeeClose: string;
  /** Maximum funding rate, as a decimal string. */
  maxFundingRate: string;
  /** Minimum notional position value, as a decimal string. */
  minNotionalValue: string;
  /** Maximum order quantity, as a decimal string. */
  maxQuantity: string;
  /** Minimum tradable increment (lot size), as a decimal string. */
  lotSize: string;
  /** Minimum acceptable quote value, as a decimal string. */
  minAcceptableQuoteValue: string;
  /** Minimum acceptable portion of the liquidation fee, as a decimal string. */
  minAcceptablePortionLf: string;
  /** Collateral token address (from the price service). */
  tokenAddress: string;
  /** Funding-rate epoch duration, as a decimal string of seconds. */
  fundingRateEpochDuration: string;
  /** Funding-rate window time, as a decimal string of seconds. */
  fundingRateWindowTime: string;
  /** Long-side trading state: `0` Disabled, `1` Close only, `2` Open only, `3` Fully enabled. */
  stateLong: number;
  /** Short-side trading state: `0` Disabled, `1` Close only, `2` Open only, `3` Fully enabled. */
  stateShort: number;
  /** Minimum solver-fee cap a quote must allow on open, as a decimal string (perps-core v0.8.6 solver fees). */
  minOpenSolverFeeCap: string;
  /** Minimum solver-fee cap a quote must allow on close, as a decimal string (perps-core v0.8.6 solver fees). */
  minCloseSolverFeeCap: string;
}
