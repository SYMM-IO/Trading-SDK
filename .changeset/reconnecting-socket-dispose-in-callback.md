---
"@symmio/trading-core": patch
---

Fix WebSocket streams that reconnected after being disposed from inside their own callbacks.

Every stream runs on an internal reconnecting socket. When a connection dropped, the socket decided to retry before it notified anyone, and it never checked again. A dispose that ran synchronously inside that notification was ignored. For example, an `onStatusChange` handler that unwatches on `"reconnecting"` still got a retry: a new connection opened after the watcher was gone, and nothing could close it. The same happened for a dispose on the `"connecting"` notification that starts a retry.

The socket now re-checks after every callback, so a dispose from inside one cancels the pending retry or dial. A dispose on `"open"` also skips the stream's open handling, such as the kline watcher's `onReset`. Every stream gets the fix: `watchNotifications`, `watchTpSlNotifications`, `watchPrices`, `watchEnigmaPrices`, `watchBinancePrices`, `watchBinanceKlines`, `watchBinanceDepth`, and the candle and orderbook sources built on the last two. Nothing changes for a stream disposed outside its callbacks.

A disposed stream also stops delivering frames while its connection is still closing. The `ws` package keeps handing over frames it has already read until the server acknowledges the close, so under `ws` a `watchBinanceKlines` subscription could call `onCandle` after its unwatch.

The WebSocket concepts page now matches the code:

- Only the notification, TP/SL and price streams share pooled connections; the Binance kline and depth watchers open one connection per call.
- The pool closes a connection as soon as its last subscriber disposes; there is no grace period.
- Retries back off from 500 ms to a 10 s cap.
- No single status marks an outage. A failing stream switches between `"reconnecting"` and `"connecting"` instead of settling in `"closed"`, so watch for a stream that does not get back to `"open"`.
- `WebSocketLike` is driven through its `on*` handler properties, not `addEventListener`.

The `SocketStatus` type docs also say that `"connecting"` covers every retry dial, not only the first connect.
