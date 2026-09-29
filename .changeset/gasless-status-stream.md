---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Gasless status now streams over the gateway's WebSocket, with HTTP polling as the fallback.

Relayer status was poll-only: every workflow re-read the same record on a timer, and a UI learned about a terminal status up to a poll interval late. The gateway serves a status WebSocket per protocol instance — optional, and disabled until operators enable it — so the SDK now prefers it and keeps polling underneath, exactly where the stream is not delivering.

**`@symmio/trading-core`**

- New `watchGaslessRequest(config, { requestId, service?, onUpdate, onStatusChange?, onError? })` → `Unwatch`. It **opens a socket and nothing else**: the subscribe snapshot and every later change arrive through `onUpdate`, each carrying complete state, and `onStatusChange` tells you when to poll instead. A `watch*` that silently became an HTTP poller would break its own contract, so the fallback stays the caller's (or `waitForGaslessRequest`'s) job.
- New `supportsGaslessStatusStream(config, { chainId?, service? })`, the non-throwing check for a deployment that can stream at all.
- New `gasless.statusStream` config block: `{ enabled: boolean; origin?: string }`. `enabled` is the per-deployment opt-in the gateway's own rollout requires, and `origin` names the gateway when your HTTP goes through a proxy — a proxy that forwards HTTP cannot be assumed to forward a WebSocket upgrade. Setting `origin` alongside a gateway `url` throws `GASLESS_STREAM_ORIGIN_CONFLICT`, so exactly one place names the gateway.
- `waitForGaslessRequest` and `confirmGaslessRequest` take `transport?: "auto" | "poll"` (default `"auto"`). On `"auto"` they subscribe where the deployment allows it and poll only while the stream is not live; the resolution semantics, timeouts and transient-failure handling are unchanged, and the records are identical either way.
- New types `GaslessRequestStreamUpdate`, `GaslessStreamStatus`, `GaslessStreamStatusDetail`, `GaslessStatusTransport`, `UnwatchGaslessRequest`.
- New stream error codes surfaced through `onError`: `GASLESS_STREAM_NOT_FOUND`, `GASLESS_STREAM_INSTANCE_MISMATCH`, `GASLESS_STREAM_DISABLED`, `GASLESS_STREAM_COMMAND_INVALID`, `GASLESS_STREAM_PROTOCOL_ERROR`; plus the config-time `GASLESS_STREAM_NOT_CONFIGURED`, `GASLESS_STREAM_ORIGIN_REQUIRED` and `GASLESS_STREAM_ORIGIN_CONFLICT`.

The protocol details the gateway documents are handled inside the shared hub, one socket per `(config, service, instance)`: the `ready` handshake is awaited before any command, every frame is verified against the configured protocol instance (a mismatch disables the stream rather than trusting another deployment's data), commands are paced and single-flight because they share your request quota, the gateway's bare `{"error":"Rate limit exceeded"}` requeues a command instead of tearing down the socket, close codes decide between backoff, bounded retries and a permanent stand-down, a `NOT_FOUND` right after a `202` resubscribes for the accept race, a terminal status unsubscribes itself, and a lost heartbeat forces a reconnect.

**`@symmio/trading-react`**

- `useGaslessRequest` subscribes where the deployment allows it, writes deliveries into the same cache entries the reads use, and **stops polling while the stream is live** — the pattern `usePrices` uses for the price feed. It returns the query result plus `stream: { status, detail, live }`, so a UI can show "Live" versus "Polling", and takes `transport?: "auto" | "poll"`.
- A stream that is unavailable, disabled or misconfigured is never an error: the hook simply keeps polling, which is also the entire behavior on a deployment without a status stream.
