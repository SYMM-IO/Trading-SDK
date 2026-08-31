---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add an orderbook slice — market depth decoupled from any venue, with Binance as the first source.

An `OrderbookSource` is the whole contract: symbol metadata, a depth snapshot, and a live subscription. Ladders, depth charts and price-impact estimates are all written against that interface, never against an exchange. As with candles, `priceBasis` states what the depth actually represents — a reference exchange's resting liquidity is **not** what a SYMMIO trade executes against.

`createBinanceOrderbookSource` is the reference source for major markets. Its live book is **not** a stream of deltas applied on faith: it implements Binance's documented local-order-book procedure, verifies that every update chains onto the last, and rebuilds from a fresh snapshot the moment one does not — with `onResync` / `resyncReason` telling the consumer it happened, so a stale ladder can say so rather than drift silently. Depth limits, update speeds and the buffered-event cap are all exported constants.

The pure helpers on top work on any source's book: `groupOrderbook` (onto a tick), `accumulateOrderbook` (cumulative depth), `getOrderbookSpread`, `walkOrderbook` / `getOrderbookDepthWithin` (fill-walking for impact), plus tick utilities (`roundToTick`, `countTickDecimals`, `suggestOrderbookTickSizes`). `getOrderbookQueryOptions` keys a one-off snapshot by source id so two venues never share a cache entry.

`@symmio/trading-react` adds `useBinanceOrderbookSource` (a stable memoized source), `useLiveOrderbook` (the one most ladders want — a synchronized book, grouped onto a tick, with cumulative depth and spread already derived, exposing `isResyncing` / `resyncReason`), `useOrderbookStream` (the raw synchronized book for custom aggregation), and `useOrderbook` (a snapshot through TanStack Query). Import the value types (`Orderbook`, `OrderbookLevel`, `OrderbookSource`) from `@symmio/trading-core`.
