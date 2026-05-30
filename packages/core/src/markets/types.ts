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

/**
 * Raw contract symbol from solver API.
 *
 * @internal — use {@link Market} for the normalized shape.
 */
export interface ContractSymbol {
  state: MarketState;
  is_valid: boolean;
  rfq_allowed: boolean;
  name: string;
  symbol: string;
  asset: string;
  price_precision: number;
  quantity_precision: number;
  symbol_id: number;
  trading_fee: number;
  min_acceptable_quote_value: number;
  min_acceptable_portion_lf: number;
  max_leverage: number;
  hedger_fee_open: string;
  hedger_fee_close: string;
  max_notional_value: number;
  max_funding_rate: number;
  min_notional_value: string;
  lot_size?: string;
}

/**
 * Raw response from solver's `/contract-symbols` endpoint.
 *
 * @internal
 */
export interface ContractSymbolsResponse {
  count: number;
  symbols: ContractSymbol[];
}
