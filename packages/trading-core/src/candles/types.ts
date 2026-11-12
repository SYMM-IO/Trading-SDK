import type { SymmError } from "../shared/errors/symm-error";
import type { Unwatch } from "../websocket/notifications/watch-notifications";
import type { SocketStatus } from "../websocket/socket";

/**
 * Canonical resolution codes the SDK speaks.
 *
 * This is the SDK's own vocabulary, not any single provider's. A
 * {@link CandleSource} maps these onto its native interval strings and declares
 * the subset it can actually serve via {@link CandleSource.supportedResolutions}
 * — no venue supports all of them.
 */
export type CandleResolution =
  | "1s"
  | "10s"
  | "1m"
  | "3m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

/**
 * What the prices in a candle series actually represent.
 *
 * Surfaced deliberately rather than hidden: a chart drawn from a reference
 * exchange is not the price a SYMMIO trade settles at. A UI that lets a user
 * place orders off that chart should be able to tell them so.
 *
 * - `reference-exchange` — mark price of a third-party perp venue (e.g. Binance USD-M).
 * - `dex-pool` — spot price of an on-chain liquidity pool, USD-denominated.
 * - `solver-mark` — the SYMMIO solver's own mark price, the basis execution settles against.
 * - `price-service` — the configured price service's OHLCV series and provisional live prices.
 */
export type CandlePriceBasis = "reference-exchange" | "dex-pool" | "solver-mark" | "price-service";

/**
 * A single OHLCV bar.
 *
 * `time` is the bar's **open** time in unix **milliseconds**, UTC, aligned to
 * the resolution boundary by the venue. Chart libraries disagree on whether
 * they want seconds or milliseconds — the SDK always speaks milliseconds and
 * each adapter converts at its own edge.
 */
export interface Candle {
  /** Bar open time, unix ms, aligned to the resolution boundary. */
  time: number;
  /** Opening price. */
  open: number;
  /** Highest price traded during the bar. */
  high: number;
  /** Lowest price traded during the bar. */
  low: number;
  /** Closing price — the latest price while the bar is still in progress. */
  close: number;
  /**
   * Volume over the bar, in the unit reported by {@link CandleSymbol.volumeUnit}
   * and {@link CandleSymbol.volumeCurrency}. Sources may report base-asset or
   * quote-currency volume (for example USD). `0` can mean no traded volume or
   * no volume data; it does not identify the unit.
   */
  volume: number;
}

/**
 * Symbol metadata a chart needs before it can render a series: how to label the
 * instrument and how many decimals to draw its prices at.
 */
export interface CandleSymbol {
  /** Market name as SYMMIO names it (e.g. `"BTCUSDT"`). */
  marketName: string;
  /** The same instrument in the source's own namespace (e.g. the Binance symbol). */
  sourceSymbol: string;
  /** Human-readable description for a chart's symbol header. */
  description: string;
  /** Decimal places prices should be rendered at. */
  pricePrecision: number;
  /** Decimal places volume should be rendered at. */
  volumePrecision: number;
  /** Whether volume measures the base asset or quote currency. Absent means unspecified. */
  volumeUnit?: "base" | "quote";
  /** Currency of the volume values (e.g. `"BTC"` or `"USD"`), when known. */
  volumeCurrency?: string;
}

/**
 * Parameters for {@link CandleSource.getCandles}.
 */
export interface GetCandlesParameters {
  /** Market name as SYMMIO names it. */
  marketName: string;
  /** Bar size to fetch. Must be listed in {@link CandleSource.supportedResolutions}. */
  resolution: CandleResolution;
  /** Range start, unix ms, inclusive. */
  from: number;
  /** Range end, unix ms, exclusive. */
  to: number;
  /**
   * Maximum bars to return. A source pages internally to satisfy this, so it
   * may exceed the venue's own per-request cap.
   */
  limit?: number;
  /** Aborts in-flight requests. Wired to TanStack Query cancellation by the hooks. */
  signal?: AbortSignal;
}

/**
 * Result of {@link CandleSource.getCandles}.
 */
export interface GetCandlesReturnType {
  /** Bars in ascending time order, de-duplicated and clipped to the requested range. */
  candles: Candle[];
  /**
   * `true` when the source confirms there is no earlier history to page into.
   * A chart paging backwards should stop when it sees this. The result can
   * still contain candles, including the instrument's earliest available bar.
   * `false` also covers unknown exhaustion when a provider supplies no boundary
   * metadata. An empty window alone is not proof that older history is absent.
   */
  noMoreData: boolean;
}

/**
 * Metadata accompanying each {@link WatchCandlesParameters.onCandle} call.
 */
export interface CandleUpdateMeta {
  /**
   * `true` when the bar's interval has ended; `false` while it is forming.
   * A provider may still correct a completed bar later.
   */
  closed: boolean;
}

/** A candle-start range in Unix milliseconds, inclusive at `from` and exclusive at `to`. */
export interface CandleHistoryRange {
  /** Inclusive start of the requested or corrected window. */
  from: number;
  /** Exclusive end of the requested or corrected window. */
  to: number;
}

/**
 * Parameters for {@link CandleSource.watchCandles}.
 */
export interface WatchCandlesParameters {
  /** Market name as SYMMIO names it. */
  marketName: string;
  /** Bar size to stream. */
  resolution: CandleResolution;
  /**
   * Called on every update to the in-progress bar, and once more with
   * `closed: true` when that bar finalizes.
   */
  onCandle: (candle: Candle, meta: CandleUpdateMeta) => void;
  /**
   * Called after a reconnect or historical correction. When supplied, `range`
   * identifies corrected candle starts; refresh loaded windows intersecting it.
   * Without a range, refresh all retained history. Handlers may ignore the range
   * and perform a full reset, including adapters that cannot refresh a subset.
   */
  onReset?: (range?: CandleHistoryRange) => void;
  /** Called whenever the underlying connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport or parse error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

/**
 * A pluggable source of OHLCV data.
 *
 * This is the SDK's charting boundary. Every chart library needs the same three
 * things — symbol metadata, bars for a time range, and a live subscription — so
 * that is exactly what a source provides. Chart-library adapters
 * (`toTradingViewDatafeed`) and framework hooks (`useCandles`) are written
 * against this interface, never against a specific venue.
 *
 * Construct a source explicitly. Reference exchanges have their own endpoints;
 * deployment-specific sources can resolve their endpoints from {@link Config}.
 *
 * @example
 * ```ts
 * const source = createBinanceCandleSource();
 * const { candles } = await source.getCandles({
 *   marketName: "BTCUSDT",
 *   resolution: "1m",
 *   from: Date.now() - 60 * 60 * 1000,
 *   to: Date.now(),
 * });
 * ```
 */
export interface CandleSource {
  /** Stable identifier, used to scope query keys (e.g. `"binance:usd-m-futures"`). */
  readonly id: string;
  /** What the prices from this source represent. */
  readonly priceBasis: CandlePriceBasis;
  /** Resolutions this source can serve. */
  readonly supportedResolutions: readonly CandleResolution[];
  /**
   * Bars the venue returns per underlying request. {@link CandleSource.getCandles}
   * pages transparently past this; it is exposed so a caller can size its own
   * requests sensibly.
   */
  readonly maxCandlesPerRequest: number;
  /**
   * Resolve symbol metadata, or `undefined` when the source does not carry this
   * market.
   *
   * @param marketName - Market name as SYMMIO names it.
   */
  getSymbol(marketName: string): Promise<CandleSymbol | undefined>;
  /**
   * Fetch historical bars for a range, paging internally as needed.
   *
   * @param parameters - Market, resolution, and range.
   */
  getCandles(parameters: GetCandlesParameters): Promise<GetCandlesReturnType>;
  /**
   * Subscribe to live bar updates. Absent when the source has no realtime feed,
   * in which case a consumer must poll {@link CandleSource.getCandles}.
   *
   * @param parameters - Market, resolution, and handlers.
   * @returns An unwatch function that releases the subscription.
   */
  watchCandles?(parameters: WatchCandlesParameters): Unwatch;
}
