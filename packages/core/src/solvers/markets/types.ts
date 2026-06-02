/**
 * Market trading state from solver.
 *
 * @remarks
 * Values match the solver API's numeric encoding. Do not reorder.
 */
export enum MarketState {
  Disabled = 0,
  CloseOnly = 1,
  OpenOnly = 2,
  FullyEnabled = 3,
}

/**
 * Normalized market info returned by {@link getMarkets}.
 */
export interface Market {
  /** Unique market ID from solver */
  id: number;
  /** Human-readable market name (e.g. "BTCUSDT") */
  name: string;
  /** Trading symbol */
  symbol: string;
  /** Base asset (e.g. "BTC") */
  asset: string;
  /** Current trading state */
  state: MarketState;
  /** Decimal precision for price display */
  pricePrecision: number;
  /** Decimal precision for quantity */
  quantityPrecision: number;
  /** Whether market is currently valid for trading */
  isValid: boolean;
  /** Whether RFQ (request for quote) is allowed */
  rfqAllowed: boolean;
  /** Trading fee percentage */
  tradingFee: number;
  /** Maximum allowed leverage */
  maxLeverage: number;
  /** Maximum notional value per position */
  maxNotionalValue: number;
  /** Maximum funding rate as string */
  maxFundingRate: string;
  /** Minimum acceptable quote value */
  minAcceptableQuoteValue: number;
  /** Minimum acceptable portion for limit fills */
  minAcceptablePortionLF: number;
  /** Hedger fee for opening positions */
  hedgerFeeOpen: string;
  /** Hedger fee for closing positions */
  hedgerFeeClose: string;
  /** Minimum notional value */
  minNotionalValue: number;
  /** Minimum lot size (optional) */
  lotSize?: number;
}
