/**
 * Minimal structural types for a WebSocket implementation the SDK can drive.
 *
 * Deliberately narrower than the DOM `WebSocket` lib type so `core` stays free
 * of a DOM-lib dependency and works with any compatible implementation — the
 * browser/Node global `WebSocket`, or the `ws` package in older Node. The
 * consuming layer injects one via `createConfig({ webSocketConstructor })`; when
 * omitted the SDK falls back to `globalThis.WebSocket`.
 */

/**
 * The subset of a WebSocket instance the SDK's reconnecting socket relies on.
 * Both the browser `WebSocket` and the `ws` package satisfy this shape.
 */
export interface WebSocketLike {
  /** Current connection state (0 connecting, 1 open, 2 closing, 3 closed). */
  readonly readyState: number;
  /** Send a text frame. */
  send(data: string): void;
  /** Begin closing the connection. */
  close(code?: number, reason?: string): void;
  /** Fired once the connection opens. */
  onopen: ((event: unknown) => void) | null;
  /** Fired when the connection closes, cleanly or otherwise. */
  onclose: ((event: { code?: number; reason?: string; wasClean?: boolean }) => void) | null;
  /** Fired on a transport-level error. */
  onerror: ((event: unknown) => void) | null;
  /** Fired for each inbound frame; `data` is typically a JSON string. */
  onmessage: ((event: { data: unknown }) => void) | null;
}

/**
 * A WebSocket constructor compatible with {@link WebSocketLike}. `globalThis.WebSocket`
 * and the `ws` package's export both match.
 */
export interface WebSocketConstructor {
  new (url: string, protocols?: string | string[]): WebSocketLike;
}
