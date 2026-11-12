---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add a lowcap price-service candle source and memoized React hook with UTC time-window pagination, flat candles filtered by default (`includeFlat: true` opts in), USD volume metadata, and provisional WebSocket updates reconciled through OHLCV. Support production and staging OHLCV responses, using `has_older` to stop older-history requests only at the backend boundary. Preserve unknown history exhaustion on deployments without the field. Forward candle-query cancellation and clear obsolete stream state when changing markets.

Add framework-neutral incremental candle history query options and `useCandleHistory`. Older navigation fetches only missing windows, preserves gaps and loaded data, and revalidates retained history on refresh. Reuse lowcap symbol listings for 60 seconds with shared, cancellable lookups. Keep live tick ordering independent of the client clock and avoid resets when authoritative rollover data already matches the emitted candle. Report unsupported deployments through source operations and React query/stream errors.

Add optional correction ranges to candle reset callbacks and `refreshCandleHistory` for bounded revalidation. `useCandleHistory.refresh(range)` delegates to this core action, waits for active paging, and preserves unaffected windows. Recent lowcap volume corrections no longer require every retained window to be fetched again when consumers forward the range; reconnects and hourly checks still request full refreshes. Existing reset handlers and TradingView integrations remain compatible.

Bounded history corrections replace only affected intervals and any missing live tail, preserving older pages and their exhaustion markers. Tail reads overlap the previously forming interval, including variable-length months, so partial snapshots are finalized and late or removed candles are reconciled.

Read final-price OHLCV without the obsolete `version` query parameter, matching the current production and staging contract.
