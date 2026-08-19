/**
 * Structural types for the slice of TradingView's Charting Library datafeed
 * contract the SDK implements.
 *
 * Declared here rather than imported because the Charting Library is a licensed
 * artifact a consumer self-hosts — it is not on npm, so the SDK cannot depend on
 * its types without forcing every consumer to vendor it. These interfaces are
 * structurally compatible with the real `IBasicDataFeed`, so the object
 * {@link toTradingViewDatafeed} returns can be passed straight to `widget({
 * datafeed })` and TypeScript accepts it against the library's own types.
 *
 * Only what a datafeed must provide is modeled. Fields the library passes but
 * the SDK ignores are typed loosely on purpose.
 */

/** A bar in TradingView's shape. Note `time` is unix **milliseconds** here. */
export interface TradingViewBar {
  /** Bar open time, unix ms. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Datafeed capabilities reported from `onReady`. */
export interface TradingViewDatafeedConfiguration {
  /** Resolution codes the chart may request, in the library's own vocabulary. */
  supported_resolutions?: string[];
  /** Exchanges offered in the symbol search dialog. */
  exchanges?: { value: string; name: string; desc: string }[];
  /** Instrument types offered in the symbol search dialog. */
  symbols_types?: { name: string; value: string }[];
  /** Whether the library should call `searchSymbols`. */
  supports_search?: boolean;
  /** Whether the library may group requests by resolution. */
  supports_group_request?: boolean;
  /** Whether `getMarks` is implemented (bar-level annotations). */
  supports_marks?: boolean;
  /** Whether `getTimescaleMarks` is implemented (timescale annotations). */
  supports_timescale_marks?: boolean;
}

/** Symbol metadata returned from `resolveSymbol`. */
export interface TradingViewSymbolInfo {
  ticker: string;
  name: string;
  full_name: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  format: string;
  /** `10 ** pricePrecision` — the library divides by this to place the decimal point. */
  pricescale: number;
  /** Minimum price movement in `pricescale` units. */
  minmov: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  has_seconds: boolean;
  has_empty_bars: boolean;
  supported_resolutions: string[];
  seconds_multipliers?: string[];
  volume_precision: number;
  data_status: string;
}

/** The range and bar count the library asks `getBars` for. */
export interface TradingViewPeriodParams {
  /** Range start, unix **seconds**. */
  from: number;
  /** Range end, unix **seconds**. */
  to: number;
  /** `true` on the initial load for a symbol/resolution. */
  firstDataRequest: boolean;
  /** Minimum bars the library needs, counting back from `to`. */
  countBack: number;
}

/** Metadata accompanying a `getBars` result. */
export interface TradingViewHistoryMetadata {
  /** `true` when there is nothing older, so the library stops paging back. */
  noData: boolean;
}

/**
 * The datafeed object TradingView's `widget({ datafeed })` expects.
 */
export interface TradingViewDatafeed {
  onReady(callback: (configuration: TradingViewDatafeedConfiguration) => void): void;
  searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: (symbols: unknown[]) => void): void;
  resolveSymbol(
    symbolName: string,
    onResolve: (symbolInfo: TradingViewSymbolInfo) => void,
    onError: (reason: string) => void,
  ): void;
  getBars(
    symbolInfo: TradingViewSymbolInfo,
    resolution: string,
    periodParams: TradingViewPeriodParams,
    onResult: (bars: TradingViewBar[], meta: TradingViewHistoryMetadata) => void,
    onError: (reason: string) => void,
  ): void;
  subscribeBars(
    symbolInfo: TradingViewSymbolInfo,
    resolution: string,
    onTick: (bar: TradingViewBar) => void,
    listenerGuid: string,
    onResetCacheNeeded: () => void,
  ): void;
  unsubscribeBars(listenerGuid: string): void;
}
