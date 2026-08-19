---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add a candles slice — chart data decoupled from any chart library, with Binance as the first source.

Consumers pick their own charting library, so the SDK's boundary is the data, not the widget. `CandleSource` is the whole contract: symbol metadata, historical bars for a range, and a live subscription. Everything else is written against that interface, never against a venue.

`core` gains:

- `CandleSource` / `Candle` / `CandleResolution` — the shared vocabulary, with bar times always in unix **milliseconds**, UTC.
- `CandlePriceBasis` on every source (`reference-exchange` | `dex-pool` | `solver-mark`). A chart drawn from a reference exchange is not the price a SYMMIO trade settles at, so the SDK states which it is rather than leaving the UI to assume.
- `createBinanceCandleSource` — USD-M futures by default (its symbols are perpetuals, matching what a SYMMIO market is), spot optional. History from `/klines`, live bars from the kline WebSocket, both reachable straight from a browser with no key or proxy. `exchangeInfo` is fetched once per source and cached to resolve price precision from the venue's own tick size.
- `toTradingViewDatafeed` — adapts any source to TradingView's Charting Library. The datafeed contract is modeled **structurally**, so the returned object satisfies the library's `IBasicDataFeed` without the SDK depending on a licensed package that is not on npm.
- `getCandlesQueryOptions` — TanStack options keyed by source id, so two venues never share a cache entry.

`react` gains `@symmio/trading-react/candles`: `useBinanceCandleSource` (memoized, since a source caches `exchangeInfo`), `useCandles`, `useCandleStream` (handlers read through refs, so inline arrows do not re-dial the socket), and `useTradingViewDatafeed`.

Three correctness details that a naive port of the usual datafeed gets wrong:

- **Backfill pages backwards from `to`, sending `endTime` only.** Binance caps a bounded range from its _start_: passing `startTime`, `endTime` and `limit` together returns the OLDEST `limit` bars in the window, so a chart scrolling back receives the wrong end of the range. The `from` bound is applied client-side instead.
- **Live frames are matched on symbol _and_ interval.** Matching on symbol alone lets two charts on different resolutions feed each other's series.
- **A reconnect raises `onReset`**, wired to the library's `onResetCacheNeeded`, so a gap forces a history refetch rather than splicing a live bar onto a stale series. Requests are also capped at the real per-market maximum (1500 on futures, 1000 on spot), which is a hard `-1130` error rather than a silent clamp.

Lowcap markets are deliberately out of scope here: their candles need a different source, and the price basis question there is unresolved.
