/**
 * Which Binance market an order-book source reads from.
 *
 * `usd-m-futures` is the default and the correct choice for a SYMMIO perp: its
 * symbols are perpetual contracts, so the depth matches what the instrument
 * actually is. `spot` is offered for markets with no futures listing.
 */
export type BinanceOrderbookMarket = "usd-m-futures" | "spot";

/** Default REST hosts per market. */
export const BINANCE_DEPTH_REST_URL: Record<BinanceOrderbookMarket, string> = {
  "usd-m-futures": "https://fapi.binance.com",
  spot: "https://api.binance.com",
};

/**
 * Default combined-stream WebSocket endpoints per market.
 *
 * **The futures path is `/public/`, and it is not interchangeable with the
 * candles slice's `/market/`.** Binance routes futures streams by class:
 * `/public` carries `@depth`, partial depth and `@bookTicker`, while `/market`
 * carries `@kline_*`, `@aggTrade`, `@markPrice` and `@ticker`. Subscribing on
 * the wrong route is not an error — the server acknowledges with
 * `{"result":null}` and then never pushes a single frame, so the book reports
 * `open` and stays empty forever. Verified against the live endpoint:
 * `@depth@500ms` delivers on `/public/stream` and delivers nothing on
 * `/market/stream`; `@kline_1m` does the exact opposite.
 *
 * The legacy unrouted `/stream` still carries depth because depth is a public
 * stream, but it was decommissioned for everything else in April 2026 and is
 * not what new code should dial.
 *
 * Spot has no such routing — one combined-stream endpoint serves everything.
 */
export const BINANCE_DEPTH_WS_URL: Record<BinanceOrderbookMarket, string> = {
  "usd-m-futures": "wss://fstream.binance.com/public/stream",
  spot: "wss://stream.binance.com:9443/stream",
};

/** Depth-snapshot REST path per market. */
export const BINANCE_DEPTH_PATH: Record<BinanceOrderbookMarket, string> = {
  "usd-m-futures": "/fapi/v1/depth",
  spot: "/api/v3/depth",
};

/** Exchange-info REST path per market, used to resolve tick size and precision. */
export const BINANCE_ORDERBOOK_EXCHANGE_INFO_PATH: Record<BinanceOrderbookMarket, string> = {
  "usd-m-futures": "/fapi/v1/exchangeInfo",
  spot: "/api/v3/exchangeInfo",
};

/**
 * Snapshot depths each market accepts.
 *
 * Futures takes an **enum**, not a range: anything else fails outright with
 * `-4021 "<n> is not valid depth limit"` rather than being clamped. Spot takes
 * any limit and clamps at its maximum, so only the ceiling is listed.
 */
export const BINANCE_DEPTH_LIMITS: Record<BinanceOrderbookMarket, readonly number[]> = {
  "usd-m-futures": [5, 10, 20, 50, 100, 500, 1000],
  spot: [5, 10, 20, 50, 100, 500, 1000, 5000],
};

/**
 * Default snapshot depth per market.
 *
 * 1000 levels on both. Deep enough that a large sweep does not empty the
 * visible ladder before the next snapshot, and it is the depth Binance's own
 * local-order-book procedure specifies.
 */
export const BINANCE_DEPTH_DEFAULT_LIMIT: Record<BinanceOrderbookMarket, number> = {
  "usd-m-futures": 1000,
  spot: 1000,
};

/**
 * Diff-stream update speeds each market serves, in milliseconds.
 *
 * Futures offers 250ms (the suffix-less default), 500ms and 100ms; spot offers
 * only 1000ms and 100ms. Asking for a speed the market does not serve yields a
 * stream name that is accepted and never delivers.
 */
export const BINANCE_DEPTH_UPDATE_SPEEDS: Record<BinanceOrderbookMarket, readonly number[]> = {
  "usd-m-futures": [100, 250, 500],
  spot: [100, 1000],
};

/** Default diff-stream update speed per market, in milliseconds. */
export const BINANCE_DEPTH_DEFAULT_UPDATE_SPEED: Record<BinanceOrderbookMarket, number> = {
  "usd-m-futures": 500,
  spot: 1000,
};

/**
 * Levels per side emitted on each update when a caller does not say.
 *
 * The internal book tracks every level the venue sends; this only bounds what
 * crosses the callback, so a 15-row ladder does not allocate 2000 objects a tick.
 */
export const BINANCE_DEPTH_DEFAULT_LEVELS = 50;

/**
 * Buffered diff events retained while a snapshot is in flight.
 *
 * At the slowest update speed this is well over a minute of runway, far more
 * than a snapshot needs. The cap exists so a snapshot that never resolves
 * cannot grow the buffer without bound; when it trips, the **oldest** events
 * are dropped and the resulting gap is caught by the continuity check rather
 * than silently corrupting the book.
 */
export const BINANCE_DEPTH_MAX_BUFFERED_EVENTS = 200;
