/**
 * Hand-written wire types for Binance USD-M Futures.
 *
 * These are **not** generated. Binance publishes an official OpenAPI spec for
 * SPOT only; USD-M Futures is documented narratively with no machine-readable
 * spec, so there is nothing for Orval to consume. See the `TODO(binance-openapi)`
 * note in `orval.config.ts` for why a community-maintained spec is deliberately
 * not used as a build input for trade-execution types.
 *
 * Both shapes were verified against the live API. Fields the SDK does not
 * consume are documented but left off where they would be dead weight; the
 * parsers read only the keys they need and tolerate extras, because Binance ships
 * fields its own docs omit (`ap` and `st` on the mark-price stream).
 *
 * @internal
 */

/**
 * One row of `GET /fapi/v1/premiumIndex`.
 *
 * The all-symbols form returns an array of these; the `?symbol=` form returns a
 * single object. Every price field is a decimal **string** — never parse one to
 * a float, these values reach an EIP-712 payload.
 */
export interface RawBinancePremiumIndexRow {
  /** Symbol, uppercase, e.g. `"BTCUSDT"`. Equals the SYMMIO market `name`. */
  symbol: string;
  /** Mark price. */
  markPrice: string;
  /** Index price (spot composite). */
  indexPrice: string;
  /** Estimated settle price; only meaningful in the last hour before settlement. */
  estimatedSettlePrice?: string;
  /** Binance's own last funding rate for this perpetual. */
  lastFundingRate: string;
  /** Binance's base interest rate. Unused by the SDK. */
  interestRate?: string;
  /** Next funding settlement (unix ms). */
  nextFundingTime: number;
  /** Server time for this quote (unix ms). */
  time?: number;
}

/**
 * One symbol listed by `GET /fapi/v1/exchangeInfo`.
 *
 * The live payload carries ~24 fields plus a `filters` array; only the ones with
 * a clear consumer are declared. Extra fields are preserved at runtime — this
 * type narrows what the SDK promises, not what the vendor sends.
 */
export interface BinanceExchangeSymbol {
  /** Symbol, uppercase, e.g. `"BTCUSDT"`. Equals the SYMMIO market `name`. */
  symbol: string;
  /** Underlying pair, e.g. `"BTCUSDT"`. */
  pair: string;
  /** Contract type, e.g. `"PERPETUAL"`. */
  contractType: string;
  /** Listing status, e.g. `"TRADING"`. */
  status: string;
  /** Base asset, e.g. `"BTC"` — SYMMIO's `Market.symbol`. */
  baseAsset: string;
  /** Quote asset, e.g. `"USDT"` — SYMMIO's `Market.asset`. */
  quoteAsset: string;
  /** Decimal places Binance quotes prices to. */
  pricePrecision: number;
  /** Decimal places Binance accepts quantities to. */
  quantityPrecision: number;
}

/**
 * Response of `GET /fapi/v1/exchangeInfo`.
 *
 * **~1 MB.** Cheap on request weight (1) but expensive to transfer and parse, so
 * it must be cached hard and never polled.
 */
export interface RawBinanceExchangeInfo {
  /** Server time (unix ms). */
  serverTime: number;
  /** Every listed contract. */
  symbols: BinanceExchangeSymbol[];
}

/**
 * One entry of the `!markPrice@arr@1s` stream.
 *
 * The stream pushes a top-level JSON **array** of these once per second, one per
 * listed symbol (~740 entries live). Every price field arrives as a decimal
 * string.
 */
export interface RawBinanceMarkPriceFrame {
  /** Event type, always `"markPriceUpdate"`. */
  e?: string;
  /** Event time (unix ms). */
  E?: number;
  /** Symbol, uppercase, e.g. `"BTCUSDT"`. */
  s: string;
  /** Mark price. */
  p: string;
  /** Index price. */
  i?: string;
  /** Estimated settle price. Unused. */
  P?: string;
  /** Binance's own last funding rate. */
  r?: string;
  /** Next funding settlement (unix ms). */
  T?: number;
}
