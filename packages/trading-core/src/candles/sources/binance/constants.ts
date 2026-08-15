/**
 * Which Binance market a candle source reads from.
 *
 * `usd-m-futures` is the default and the correct choice for charting a SYMMIO
 * perp: its symbols are perpetual contracts, so the series matches what the
 * instrument actually is. `spot` is offered for markets that have no futures
 * listing.
 */
export type BinanceMarket = "usd-m-futures" | "spot";

/** Default REST hosts per market. */
export const BINANCE_REST_URL: Record<BinanceMarket, string> = {
  "usd-m-futures": "https://fapi.binance.com",
  spot: "https://api.binance.com",
};

/**
 * Default combined-stream WebSocket endpoints per market.
 *
 * The `/stream` (combined) form is used rather than `/ws` (raw) so every frame
 * arrives wrapped as `{ stream, data }` and further streams can be multiplexed
 * onto one connection later without changing the parse path.
 *
 * The futures `/market/` prefix is deliberate and verified against the live
 * endpoint: on `fstream.binance.com` the documented `/stream` and `/ws` forms
 * accept the SUBSCRIBE frame, acknowledge it with `{"result":null}`, and then
 * never push a single kline — a feed that reports `open` and silently never
 * ticks. Only the `/market/` paths deliver frames. Spot needs no such prefix.
 */
export const BINANCE_WS_URL: Record<BinanceMarket, string> = {
  "usd-m-futures": "wss://fstream.binance.com/market/stream",
  spot: "wss://stream.binance.com:9443/stream",
};

/** Klines REST path per market. */
export const BINANCE_KLINES_PATH: Record<BinanceMarket, string> = {
  "usd-m-futures": "/fapi/v1/klines",
  spot: "/api/v3/klines",
};

/** Exchange-info REST path per market, used to resolve price precision. */
export const BINANCE_EXCHANGE_INFO_PATH: Record<BinanceMarket, string> = {
  "usd-m-futures": "/fapi/v1/exchangeInfo",
  spot: "/api/v3/exchangeInfo",
};

/**
 * Maximum bars a single klines request may ask for.
 *
 * Exceeding this is a hard error (`-1130 Data sent for parameter 'limit' is not
 * valid`), not a silent clamp, so requests are capped against it before being
 * sent. Futures allows 1500; spot allows 1000.
 */
export const BINANCE_MAX_LIMIT: Record<BinanceMarket, number> = {
  "usd-m-futures": 1500,
  spot: 1000,
};

/**
 * Upper bound on paging iterations inside a single `getCandles` call.
 *
 * A safety net only: paging normally stops because the venue returned a short
 * batch or the caller's `limit` was met. This guarantees the loop terminates
 * even if the venue keeps returning full batches that never advance the cursor.
 */
export const BINANCE_MAX_PAGES = 50;
