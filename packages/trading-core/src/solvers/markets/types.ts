/**
 * Fields every solver's `/contract-symbols` response carries, normalized to one
 * stable SDK shape: camelCase names, `maxLeverage` coerced to `number` (Enigma
 * returns it as a string), and no vendor optionality noise (each field is
 * required — mappers fill solver gaps with defaults).
 *
 * Not exported on its own: consume {@link Market} (or a per-kind type) so the
 * discriminant travels with the data.
 */
interface BaseMarket {
  /** Numeric symbol id, e.g. `1`. */
  symbolId: number;
  /** Display name, e.g. `"BTCUSDT"`. */
  name: string;
  /** Ticker, e.g. `"BTC"`. */
  symbol: string;
  /** Base asset, e.g. `"BTC"`. */
  asset: string;
  /** Whether the market is currently valid/known to the solver. */
  isValid: boolean;
  /** Price display precision (decimal places). */
  pricePrecision: number;
  /** Quantity display precision (decimal places). */
  quantityPrecision: number;
  /** Maximum leverage. Normalized to a number across solvers. */
  maxLeverage: number;
  /** Maximum notional position value. */
  maxNotionalValue: number;
  /** Whether RFQ (instant-open) is allowed for this market. */
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
}

/**
 * A market from an **Enigma**-kind solver. Extends {@link BaseMarket} with the
 * fields only Enigma returns — these are absent from the type on any other
 * solver, so accessing them without first narrowing on `kind` is a compile
 * error (that is how the SDK tells you a Rasa market has no `state`).
 */
export interface EnigmaMarket extends BaseMarket {
  /** Discriminant: this market came from an Enigma solver. */
  kind: "enigma";
  /** Allowed side: `"all"`, `"long"`, or `"short"`. Enigma-only. */
  side: string;
  /** Trading state: `0` Disabled, `1` Close only, `2` Open only, `3` Fully enabled. Enigma-only. */
  state: number;
  /** Collateral token address (from the price service). Enigma-only. */
  tokenAddress: string;
  /** Funding-rate epoch duration. Enigma-only. */
  fundingRateEpochDuration: string;
  /** Funding-rate window time. Enigma-only. */
  fundingRateWindowTime: string;
}

/**
 * A market from a **Rasa**-kind solver. Carries only the shared
 * {@link BaseMarket} fields — Rasa exposes no `state`/`side`/`tokenAddress`, and
 * the type reflects that (those properties do not exist here).
 */
export interface RasaMarket extends BaseMarket {
  /** Discriminant: this market came from a Rasa solver. */
  kind: "rasa";
}

/**
 * A tradable market from any configured solver. A discriminated union on
 * `kind` — narrow (`if (market.kind === "enigma")`) to reach solver-specific
 * fields. {@link getMarkets} returns the exact per-kind arm when called with a
 * literal `solverId`, and this union when `solverId` is omitted.
 */
export type Market = EnigmaMarket | RasaMarket;

/**
 * Maps each solver kind to its normalized market type. Drives the generic
 * return of {@link getMarkets}: `NormalizedMarketByKind[K]` is the market type
 * for kind `K`.
 */
export interface NormalizedMarketByKind {
  enigma: EnigmaMarket;
  rasa: RasaMarket;
}
