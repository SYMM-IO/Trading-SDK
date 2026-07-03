/**
 * Lifecycle state of a managed SDK WebSocket connection.
 *
 * - `connecting` — a socket is dialing for the first time.
 * - `open` — connected; frames flow.
 * - `reconnecting` — the connection dropped and a retry is scheduled (backoff).
 * - `closing` — a consumer-initiated close is in progress.
 * - `closed` — terminally closed; no further reconnects.
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
