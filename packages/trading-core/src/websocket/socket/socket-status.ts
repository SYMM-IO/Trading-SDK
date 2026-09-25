/**
 * Lifecycle state of a managed SDK WebSocket connection.
 *
 * - `connecting` — dialing: on the first connect and again each time a backoff wait ends.
 * - `open` — connected; frames flow.
 * - `reconnecting` — the connection dropped, or a dial failed, and a retry is scheduled (backoff).
 * - `closing` — a consumer-initiated close is in progress.
 * - `closed` — terminally closed; no further reconnects.
 *
 * A `reconnecting` → `connecting` → `open` cycle is normal after a dropped
 * connection. No single status marks an outage: a failing endpoint keeps
 * switching between `reconnecting` and `connecting`, and a server that drops
 * every connection right after accepting it keeps passing through `open`.
 */
export type SocketStatus = "connecting" | "open" | "reconnecting" | "closing" | "closed";

/**
 * Numeric `readyState` values defined by the WebSocket standard. Named here so
 * the SDK never compares against bare integer literals.
 */
export const SOCKET_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;
