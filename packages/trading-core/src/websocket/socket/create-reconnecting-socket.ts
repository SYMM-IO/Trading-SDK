import type { WebSocketConstructor, WebSocketLike } from "../../shared/types/websocket";
import { computeBackoffDelay } from "./backoff";
import { SOCKET_READY_STATE, type SocketStatus } from "./socket-status";

/**
 * Reconnect tuning for {@link createReconnectingSocket}. All fields optional;
 * defaults match the SDK's notifications behavior (unlimited retries, 500ms →
 * 10s exponential backoff with jitter).
 */
export interface ReconnectingSocketReconnectOptions {
  /** Reconnect after an unclean close. Default `true`. */
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
  /** Whether the socket will attempt to reconnect after this close. */
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
  /** Called each time the underlying connection closes (transient or terminal). */
  onClose?: (info: SocketCloseInfo) => void;
  /** Called on a transport-level error; receives the raw error event. */
  onError?: (event: unknown) => void;
  /** Called for each inbound frame; `data` is the raw `event.data` (usually a JSON string). */
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
  /** Close permanently (no reconnect), flushing timers. Idempotent. */
  close(): void;
  /** Current connection status. */
  getStatus(): SocketStatus;
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

  function safeSend(target: WebSocketLike, data: string): void {
    try {
      if (target.readyState === SOCKET_READY_STATE.OPEN) target.send(data);
    } catch (err) {
      options.onError?.(err);
    }
  }

  function startHeartbeat(target: WebSocketLike): void {
    if (!heartbeat.enabled) return;
    stopHeartbeat();
    heartbeatTimer = setInterval(() => safeSend(target, heartbeat.message), heartbeat.intervalMs);
  }

  function connect(): void {
    clearReconnectTimer();
    setStatus("connecting");

    let socket: WebSocketLike;
    try {
      socket = new options.webSocketConstructor(options.url, options.protocols);
    } catch (err) {
      options.onError?.(err);
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      if (ws !== socket) return;
      attempt = 0;
      setStatus("open");
      options.onOpen?.();
      for (const message of options.getOpenMessages?.() ?? []) safeSend(socket, message);
      if (outbox.length > 0) {
        const pending = outbox;
        outbox = [];
        for (const message of pending) safeSend(socket, message);
      }
      startHeartbeat(socket);
    };

    socket.onmessage = (event) => {
      if (ws !== socket) return;
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

      const willReconnect = !closedByUser && reconnect.enabled && attempt < reconnect.maxAttempts;
      options.onClose?.({ code: event?.code, reason: event?.reason, willReconnect });

      if (!willReconnect) {
        setStatus("closed");
        return;
      }
      scheduleReconnect();
    };
  }

  function scheduleReconnect(): void {
    setStatus("reconnecting");
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

  function close(): void {
    if (closedByUser) return;
    closedByUser = true;
    clearReconnectTimer();
    stopHeartbeat();
    outbox = [];

    if (ws) {
      setStatus("closing");
      try {
        ws.close();
      } catch {
        // ignore — onclose may not fire if the socket never opened
        setStatus("closed");
      }
    } else {
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
