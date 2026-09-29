import type { WebSocketConstructor, WebSocketLike } from "../../shared/types/websocket";
import { computeBackoffDelay } from "./backoff";
import { SOCKET_READY_STATE, type SocketStatus } from "./socket-status";

/**
 * Reconnect tuning for {@link createReconnectingSocket}. All fields optional;
 * defaults match the SDK's notifications behavior (unlimited retries, 500ms →
 * 10s exponential backoff with jitter).
 */
export interface ReconnectingSocketReconnectOptions {
  /**
   * Redial when the connection closes, or a dial throws, without `close()`
   * having been called. The close code is not inspected. Default `true`.
   */
  enabled?: boolean;
  /** Max consecutive retries before giving up. Default `Infinity`. */
  maxAttempts?: number;
  /** Delay before the first retry, in ms. Default `500`. */
  baseDelayMs?: number;
  /** Upper bound on any single retry delay, in ms. Default `10_000`. */
  maxDelayMs?: number;
  /** Apply random jitter to retry delays. Default `true`. */
  jitter?: boolean;
}

/**
 * Heartbeat tuning for {@link createReconnectingSocket}. Disabled by default —
 * enable only when the server expects periodic client keepalive frames.
 */
export interface ReconnectingSocketHeartbeatOptions {
  /** Send a periodic keepalive frame while open. Default `false`. */
  enabled?: boolean;
  /** Interval between keepalive frames, in ms. Default `30_000`. */
  intervalMs?: number;
  /** The keepalive frame to send. Default `"ping"`. */
  message?: string;
}

/**
 * Reason a socket closed, delivered to {@link ReconnectingSocketOptions.onClose}.
 */
export interface SocketCloseInfo {
  /** WebSocket close code, if the implementation supplied one. */
  code?: number;
  /** WebSocket close reason, if any. */
  reason?: string;
  /** Whether the connection closed cleanly (the closing handshake completed), if the implementation reported it. */
  wasClean?: boolean;
  /**
   * Whether the socket will attempt to reconnect after this close. Calling
   * {@link ReconnectingSocket.close} from inside `onClose` cancels a reconnect
   * reported here as `true`.
   */
  willReconnect: boolean;
}

/**
 * Options for {@link createReconnectingSocket}.
 */
export interface ReconnectingSocketOptions {
  /** Endpoint URL (`ws://` / `wss://`). */
  url: string;
  /** Optional subprotocol(s), forwarded to the WebSocket constructor. */
  protocols?: string | string[];
  /** WebSocket implementation to dial with (resolve from `config.getWebSocketConstructor()`). */
  webSocketConstructor: WebSocketConstructor;
  /**
   * Frames sent on every (re)open, in order, before any buffered `send`s.
   * Put subscribe messages here so subscriptions are re-established after a
   * reconnect without consumer involvement.
   */
  getOpenMessages?: () => string[];
  /** Reconnect tuning. */
  reconnect?: ReconnectingSocketReconnectOptions;
  /** Heartbeat tuning. */
  heartbeat?: ReconnectingSocketHeartbeatOptions;
  /** Called each time the socket transitions to `open`. */
  onOpen?: () => void;
  /**
   * Called each time the underlying connection closes (transient or terminal).
   * A dial that throws is reported to `onError` instead, and `close()` while no
   * connection exists (for example during a backoff wait) settles the status
   * without calling this.
   */
  onClose?: (info: SocketCloseInfo) => void;
  /** Called on a transport-level error; receives the raw error event. */
  onError?: (event: unknown) => void;
  /**
   * Called for each inbound frame; `data` is the raw `event.data` (usually a
   * JSON string). Not called after `close()`, even for a frame the
   * implementation still delivers while the connection finishes closing.
   */
  onMessage?: (data: unknown) => void;
  /** Called whenever {@link SocketStatus} changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Randomness source for backoff jitter. Injectable for tests; defaults to `Math.random`. */
  random?: () => number;
}

/**
 * A managed, self-reconnecting WebSocket handle.
 */
export interface ReconnectingSocket {
  /** Send a text frame now if open, otherwise buffer it until the next open. */
  send(data: string): void;
  /**
   * Close permanently: cancel any pending reconnect, stop the heartbeat, drop
   * buffered sends, and close the current connection. From this call on no
   * frame reaches `onMessage`, even while the connection is still closing. Safe
   * to call from any callback, including `onClose` and `onStatusChange`.
   * Idempotent — only the first call acts, so a later call's `code` and
   * `reason` are ignored.
   *
   * `code` and `reason` are checked before the connection is touched, the same
   * way for every implementation and whether or not a connection is open. When
   * either breaks the limits below, a `RangeError` goes to `onError` and the
   * connection closes without them.
   *
   * @param code - Close code to send: `1000`, or an integer from `3000` to `4999` — the codes the WebSocket standard lets a client send. Any other code is rejected, even one the implementation would send (the `ws` package accepts `1001`).
   * @param reason - Close reason to send, at most 123 UTF-8 bytes.
   */
  close(code?: number, reason?: string): void;
  /** Current connection status. */
  getStatus(): SocketStatus;
}

/** The longest reason a WebSocket close frame can carry, in UTF-8 bytes. */
const MAX_CLOSE_REASON_BYTES = 123;

/** Whether a client may send `code`: `1000`, or an integer from `3000` to `4999`. */
function isClientCloseCode(code: number): boolean {
  return code === 1000 || (Number.isInteger(code) && code >= 3000 && code <= 4999);
}

/**
 * Why `close(code, reason)` must not send these arguments, or `undefined` when
 * it may. Applies the WebSocket standard's limits for a client.
 */
function getCloseArgumentsError(code?: number, reason?: string): RangeError | undefined {
  if (code !== undefined && !isClientCloseCode(code)) {
    return new RangeError(`WebSocket close code ${code} is not allowed; use 1000 or an integer from 3000 to 4999.`);
  }
  if (reason === undefined) return undefined;
  const reasonBytes = new TextEncoder().encode(reason).length;
  if (reasonBytes <= MAX_CLOSE_REASON_BYTES) return undefined;
  return new RangeError(
    `WebSocket close reason is ${reasonBytes} UTF-8 bytes; the limit is ${MAX_CLOSE_REASON_BYTES}.`,
  );
}

/**
 * Create a self-reconnecting WebSocket around an injected implementation.
 *
 * Handles the reliability concerns a raw `WebSocket` does not: exponential
 * backoff with jitter, status transitions, outbound buffering while not open,
 * and re-sending `getOpenMessages()` on every (re)open so subscriptions survive
 * reconnects. Framework-agnostic — no DOM or React assumptions; the socket
 * implementation and randomness are injected.
 *
 * The returned socket starts dialing immediately.
 *
 * @example
 * ```ts
 * const socket = createReconnectingSocket({
 *   url: "wss://example/ws",
 *   webSocketConstructor: config.getWebSocketConstructor(),
 *   getOpenMessages: () => [JSON.stringify({ subscribe: account })],
 *   onMessage: (data) => handle(JSON.parse(String(data))),
 * });
 * // later
 * socket.close();
 * ```
 */
export function createReconnectingSocket(options: ReconnectingSocketOptions): ReconnectingSocket {
  const reconnect = {
    enabled: options.reconnect?.enabled ?? true,
    maxAttempts: options.reconnect?.maxAttempts ?? Number.POSITIVE_INFINITY,
    baseDelayMs: options.reconnect?.baseDelayMs ?? 500,
    maxDelayMs: options.reconnect?.maxDelayMs ?? 10_000,
    jitter: options.reconnect?.jitter ?? true,
  };
  const heartbeat = {
    enabled: options.heartbeat?.enabled ?? false,
    intervalMs: options.heartbeat?.intervalMs ?? 30_000,
    message: options.heartbeat?.message ?? "ping",
  };

  let ws: WebSocketLike | null = null;
  let status: SocketStatus = "connecting";
  let attempt = 0;
  let closedByUser = false;
  let outbox: string[] = [];
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function setStatus(next: SocketStatus): void {
    if (status === next) return;
    status = next;
    options.onStatusChange?.(next);
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /**
   * Whether `target` is still the live connection. Every consumer callback runs
   * synchronously and may call `close()`, so handlers re-check this after each
   * callback instead of trusting what they read before it.
   */
  function isCurrent(target: WebSocketLike): boolean {
    return !closedByUser && ws === target;
  }

  /** Whether a lost connection or failed dial should be retried. */
  function canReconnect(): boolean {
    return !closedByUser && reconnect.enabled && attempt < reconnect.maxAttempts;
  }

  function safeSend(target: WebSocketLike, data: string): void {
    try {
      if (target.readyState === SOCKET_READY_STATE.OPEN) target.send(data);
    } catch (err) {
      options.onError?.(err);
    }
  }

  function startHeartbeat(target: WebSocketLike): void {
    /** Arming the interval for a connection that is already closed would leak it. */
    if (!heartbeat.enabled || !isCurrent(target)) return;
    stopHeartbeat();
    heartbeatTimer = setInterval(() => safeSend(target, heartbeat.message), heartbeat.intervalMs);
  }

  function connect(): void {
    clearReconnectTimer();
    if (closedByUser) return;
    setStatus("connecting");
    /** A status listener may have closed the socket; a dial now would open a connection nothing can close. */
    if (closedByUser) return;

    let socket: WebSocketLike;
    try {
      socket = new options.webSocketConstructor(options.url, options.protocols);
    } catch (err) {
      options.onError?.(err);
      if (canReconnect()) scheduleReconnect();
      else setStatus("closed");
      return;
    }
    ws = socket;

    socket.onopen = () => {
      if (!isCurrent(socket)) return;
      attempt = 0;
      setStatus("open");
      if (!isCurrent(socket)) return;
      options.onOpen?.();
      if (!isCurrent(socket)) return;
      for (const message of options.getOpenMessages?.() ?? []) safeSend(socket, message);
      if (outbox.length > 0) {
        const pending = outbox;
        outbox = [];
        for (const message of pending) safeSend(socket, message);
      }
      startHeartbeat(socket);
    };

    socket.onmessage = (event) => {
      /**
       * `isCurrent` also drops frames after `close()`: the `ws` package keeps
       * delivering what it parses until the closing handshake completes.
       */
      if (!isCurrent(socket)) return;
      options.onMessage?.(event.data);
    };

    socket.onerror = (event) => {
      if (ws !== socket) return;
      options.onError?.(event);
    };

    socket.onclose = (event) => {
      if (ws !== socket) return;
      stopHeartbeat();
      ws = null;

      const willReconnect = canReconnect();
      options.onClose?.({ code: event?.code, reason: event?.reason, wasClean: event?.wasClean, willReconnect });

      /** `onClose` may have called `close()`, which overrides the reconnect it was told about. */
      if (willReconnect && !closedByUser) {
        scheduleReconnect();
        return;
      }
      setStatus("closed");
    };
  }

  function scheduleReconnect(): void {
    if (closedByUser) return;
    setStatus("reconnecting");
    /** A status listener may have closed the socket; a timer armed now would redial after a permanent close. */
    if (closedByUser) return;
    const delay = computeBackoffDelay(attempt, reconnect, options.random);
    attempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  function send(data: string): void {
    if (ws && ws.readyState === SOCKET_READY_STATE.OPEN) {
      safeSend(ws, data);
    } else {
      outbox.push(data);
    }
  }

  /**
   * Close the transport without arguments, then report why they were dropped.
   * The report goes out even when the implementation refuses to close.
   */
  function closeWithoutArguments(target: WebSocketLike, error: unknown): void {
    try {
      target.close();
    } finally {
      options.onError?.(error);
    }
  }

  /**
   * Close the transport with arguments that passed the check in `close`. A bare
   * `close()` is forwarded without arguments, so an implementation that
   * branches on argument count sees the call it always has.
   */
  function closeTransport(target: WebSocketLike, code?: number, reason?: string): void {
    if (code === undefined && reason === undefined) {
      target.close();
      return;
    }
    try {
      target.close(code, reason);
    } catch (err) {
      /** An implementation stricter than the standard; this recovers one that rejects before it changes state. */
      closeWithoutArguments(target, err);
    }
  }

  function close(code?: number, reason?: string): void {
    if (closedByUser) return;
    closedByUser = true;
    clearReconnectTimer();
    stopHeartbeat();
    outbox = [];

    /**
     * Checked here rather than left to the implementation: browsers and Node's
     * global `WebSocket` reject before they change state, but the `ws` package
     * marks itself closing first, so a bare `close()` after its throw does
     * nothing and the connection stays open. Checked with or without a
     * connection, so a bad argument is reported whatever the timing.
     */
    const argumentsError = getCloseArgumentsError(code, reason);
    const target = ws;
    if (!target) {
      setStatus("closed");
      if (argumentsError) options.onError?.(argumentsError);
      return;
    }
    setStatus("closing");
    try {
      if (argumentsError) {
        closeWithoutArguments(target, argumentsError);
      } else {
        closeTransport(target, code, reason);
      }
    } catch {
      /** The implementation refused to close, so `onclose` may never fire; settle the status here. */
      setStatus("closed");
    }
  }

  connect();

  return {
    send,
    close,
    getStatus: () => status,
  };
}
