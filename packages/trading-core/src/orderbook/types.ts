import type { SymmError } from "../shared/errors/symm-error";
import type { Unwatch } from "../websocket/notifications/watch-notifications";
import type { SocketStatus } from "../websocket/socket";

/**
 * What the prices in an order book actually represent.
 *
 * Surfaced deliberately rather than hidden: a book taken from a reference
 * exchange is not the liquidity a SYMMIO trade executes against. A UI that
 * sizes an order off this book should be able to tell the user so.
 *
 * - `reference-exchange` — resting orders on a third-party venue (e.g. Binance USD-M).
 * - `dex-pool` — depth synthesized from an on-chain liquidity pool's curve.
 * - `solver-mark` — the SYMMIO solver's own quoted depth, what execution settles against.
 *
 * Intentionally mirrors `CandlePriceBasis`. The two slices keep their own
 * vocabulary so a venue can supply one without implying the other.
 */
export type OrderbookPriceBasis = "reference-exchange" | "dex-pool" | "solver-mark";

/**
 * A single resting price level.
 *
 * `size` is a base-asset quantity — the notional at this level is
 * `price * size`. Both are plain numbers: venues quote depth as decimal
 * strings well inside IEEE-754's exact range, and a book is read far more
 * often than it is summed.
 */
export interface OrderbookLevel {
  /** Limit price, quote-asset denominated. */
  price: number;
  /** Resting quantity at this price, base-asset denominated. */
  size: number;
}

/**
 * A price level with the depth resting at or better than it.
 *
 * Produced by {@link accumulateOrderbook}. Totals are **inclusive** of the
 * level's own size, so the last entry's `total` is the depth of the whole
 * series — the value a depth bar should normalize against.
 */
export interface OrderbookDepthLevel extends OrderbookLevel {
  /** Cumulative base-asset size from the best price through this level, inclusive. */
  total: number;
  /** Cumulative notional (`Σ price × size`) through this level, inclusive. */
  totalQuote: number;
}

/**
 * A point-in-time order book.
 *
 * `bids` descend from the best (highest) bid; `asks` ascend from the best
 * (lowest) ask. Both sides are de-duplicated by price and carry no zero-size
 * levels.
 */
export interface Orderbook {
  /** Market name as SYMMIO names it. */
  marketName: string;
  /** Resting buy orders, best (highest price) first. */
  bids: OrderbookLevel[];
  /** Resting sell orders, best (lowest price) first. */
  asks: OrderbookLevel[];
  /**
   * Venue sequence number this book is synchronized to.
   *
   * Monotonic per market. A consumer holding two books for the same market can
   * compare this to tell which is newer; it is meaningless across markets or
   * across sources.
   */
  lastUpdateId: number;
  /** When the venue produced this book, unix ms. `0` when the venue omits it. */
  timestamp: number;
}

/**
 * Best prices and the gap between them.
 *
 * `undefined` from {@link getOrderbookSpread} when either side is empty — a
 * one-sided book has no spread, and reporting `0` would read as a locked market.
 */
export interface OrderbookSpread {
  /** Highest resting bid. */
  bestBid: number;
  /** Lowest resting ask. */
  bestAsk: number;
  /** `bestAsk - bestBid`, in quote-asset units. Negative when the book is crossed. */
  spread: number;
  /** The spread as basis points of {@link OrderbookSpread.midPrice}. */
  spreadBps: number;
  /** Arithmetic mid, `(bestBid + bestAsk) / 2`. */
  midPrice: number;
}

/** Direction of a hypothetical market order walked through a book. */
export type OrderbookWalkSide = "buy" | "sell";

/**
 * Result of filling a hypothetical market order against resting depth.
 *
 * Produced by {@link walkOrderbook}. Every field is derived from the book
 * alone: no fees, no funding, and no solver spread are applied.
 */
export interface OrderbookWalk {
  /** Direction that was walked. `buy` consumed asks, `sell` consumed bids. */
  side: OrderbookWalkSide;
  /** Base-asset size requested. */
  requestedSize: number;
  /** Base-asset size actually fillable — less than requested when depth ran out. */
  filledSize: number;
  /** Quote-asset cost (buy) or proceeds (sell) of the fill. */
  filledQuote: number;
  /** Size-weighted average fill price, or `undefined` when nothing filled. */
  averagePrice?: number;
  /** Best price on the side walked, or `undefined` when that side is empty. */
  bestPrice?: number;
  /** Price of the deepest level touched, or `undefined` when nothing filled. */
  worstPrice?: number;
  /**
   * Cost of crossing the book, in basis points of {@link OrderbookWalk.bestPrice}.
   *
   * Always `>= 0`: a buy averages above the best ask, a sell below the best
   * bid, and both are reported as a positive cost. `0` when nothing filled.
   */
  slippageBps: number;
  /** `true` when the book held less depth than requested. */
  partial: boolean;
  /** Number of price levels consumed. */
  levelsConsumed: number;
}

/**
 * Depth resting near the mid, per side.
 *
 * Produced by {@link getOrderbookDepthWithin}. A liquidity read that is robust
 * to a single large far-out order, unlike top-of-book size.
 */
export interface OrderbookDepthSummary {
  /** How far from mid the window extends, as a fraction (`0.01` = ±1%). */
  percent: number;
  /** Base-asset size resting on the bid side inside the window. */
  bidSize: number;
  /** Base-asset size resting on the ask side inside the window. */
  askSize: number;
  /** Notional resting on the bid side inside the window. */
  bidQuote: number;
  /** Notional resting on the ask side inside the window. */
  askQuote: number;
  /**
   * `(bidQuote - askQuote) / (bidQuote + askQuote)`, in `[-1, 1]`.
   *
   * Positive means more resting bid notional than ask — buy-side pressure.
   * `0` when the window is empty on both sides.
   */
  imbalance: number;
}

/**
 * Symbol metadata a book needs before it can be rendered: how to label the
 * instrument and how many decimals to draw its prices and sizes at.
 */
export interface OrderbookSymbol {
  /** Market name as SYMMIO names it (e.g. `"BTCUSDT"`). */
  marketName: string;
  /** The same instrument in the source's own namespace. */
  sourceSymbol: string;
  /** Base asset (e.g. `"BTC"`), for a size column header. */
  baseAsset: string;
  /** Quote asset (e.g. `"USDT"`), for a price column header. */
  quoteAsset: string;
  /** Decimal places prices should be rendered at. */
  pricePrecision: number;
  /** Decimal places sizes should be rendered at. */
  sizePrecision: number;
  /**
   * Smallest price increment the venue allows.
   *
   * The natural finest grouping for a ladder, and the base of the ladder
   * {@link suggestOrderbookTickSizes} builds.
   */
  tickSize: number;
}

/**
 * Parameters for {@link OrderbookSource.getOrderbook}.
 */
export interface GetOrderbookParameters {
  /** Market name as SYMMIO names it. */
  marketName: string;
  /**
   * Levels per side to request. Must be one of
   * {@link OrderbookSource.supportedLimits}; defaults to
   * {@link OrderbookSource.defaultLimit}.
   */
  limit?: number;
  /** Aborts the in-flight request. Wired to TanStack Query cancellation by the hooks. */
  signal?: AbortSignal;
}

/**
 * Why an in-progress book was discarded and rebuilt from a fresh snapshot.
 *
 * - `initial` — the first build; there was no prior book.
 * - `sequence-gap` — an update did not chain onto the previous one, so at least
 *   one update was missed and the local book can no longer be trusted.
 * - `reconnect` — the socket dropped and re-dialed; updates during the gap are lost.
 * - `stale-snapshot` — the snapshot came back older than the buffered updates
 *   could bridge, so it was refetched.
 */
export type OrderbookResyncReason = "initial" | "sequence-gap" | "reconnect" | "stale-snapshot";

/**
 * Parameters for {@link OrderbookSource.watchOrderbook}.
 */
export interface WatchOrderbookParameters {
  /** Market name as SYMMIO names it. */
  marketName: string;
  /**
   * Levels per side to fetch in the snapshot the live book is built on.
   *
   * Deeper snapshots cost more venue rate-limit weight but survive large
   * sweeps without the far side of the book going blank. Defaults to
   * {@link OrderbookSource.defaultLimit}.
   */
  limit?: number;
  /**
   * Levels per side to emit on each update. Defaults to `50`.
   *
   * Independent of `limit`: the source tracks the full book internally and
   * trims only at the callback, so a ladder showing 15 rows does not pay for
   * 1000 objects per tick.
   */
  levels?: number;
  /**
   * Called with a complete book on every applied update — never a delta.
   *
   * Each call receives a fresh object, so a consumer can hold onto one without
   * it mutating underneath them.
   */
  onOrderbook: (orderbook: Orderbook) => void;
  /**
   * Called whenever the book is being rebuilt.
   *
   * Fires *before* the rebuild completes, so a consumer can show a stale
   * indicator; the next {@link WatchOrderbookParameters.onOrderbook} is the
   * rebuilt book.
   */
  onResync?: (reason: OrderbookResyncReason) => void;
  /** Called whenever the underlying connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport, parse, or snapshot error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

/**
 * A pluggable source of order-book data.
 *
 * This is the SDK's depth boundary, and the counterpart of `CandleSource`.
 * Every consumer of a book needs the same three things — symbol metadata, a
 * snapshot, and a live subscription — so that is what a source provides.
 * Hooks (`useOrderbook`, `useLiveOrderbook`) and the aggregation helpers are
 * written against this interface, never against a specific venue.
 *
 * Unlike most SDK actions, a source is **not** derived from `Config`: a
 * reference exchange is not a SYMMIO chain deployment, and which venue's depth
 * to show is the consumer's choice. Construct one and pass it in explicitly.
 *
 * @example
 * ```ts
 * const source = createBinanceOrderbookSource();
 * const book = await source.getOrderbook({ marketName: "BTCUSDT", limit: 20 });
 * const spread = getOrderbookSpread(book);
 * ```
 */
export interface OrderbookSource {
  /** Stable identifier, used to scope query keys (e.g. `"binance:usd-m-futures"`). */
  readonly id: string;
  /** What the prices from this source represent. */
  readonly priceBasis: OrderbookPriceBasis;
  /**
   * Depths the venue accepts for a snapshot, ascending.
   *
   * Venues that take a free-form limit report their maximum as the single
   * largest entry; venues that take an enum report every allowed value.
   */
  readonly supportedLimits: readonly number[];
  /** Depth used when a caller does not pass `limit`. */
  readonly defaultLimit: number;
  /**
   * Resolve symbol metadata, or `undefined` when the source does not carry
   * this market.
   *
   * @param marketName - Market name as SYMMIO names it.
   */
  getSymbol(marketName: string): Promise<OrderbookSymbol | undefined>;
  /**
   * Fetch a point-in-time snapshot.
   *
   * @param parameters - Market and depth.
   */
  getOrderbook(parameters: GetOrderbookParameters): Promise<Orderbook>;
  /**
   * Subscribe to a continuously synchronized book. Absent when the source has
   * no realtime feed, in which case a consumer must poll
   * {@link OrderbookSource.getOrderbook}.
   *
   * @param parameters - Market, depth, and handlers.
   * @returns An unwatch function that releases the subscription.
   */
  watchOrderbook?(parameters: WatchOrderbookParameters): Unwatch;
}
