import { SOCKET_READY_STATE } from "../../websocket/socket/socket-status";
import type { WebSocketConstructor, WebSocketLike } from "../types/websocket";

/**
 * A scriptable WebSocket instance for tests: records sent frames and exposes
 * `simulate*` helpers to drive the socket's lifecycle deterministically.
 */
export interface FakeWebSocketInstance extends WebSocketLike {
  url: string;
  /** Text frames passed to `send`, in order. */
  sent: string[];
  /**
   * The arguments of every `close` call, in order, exactly as passed: a bare
   * `close()` records `[]`. Calls the fake rejected or ignored are recorded too.
   */
  closeCalls: [code?: number, reason?: string][];
  /** Drive an `open` event. */
  simulateOpen(): void;
  /** Drive a `message` event; objects are JSON-stringified to mimic the wire. */
  simulateMessage(data: unknown): void;
  /** Drive an `error` event. */
  simulateError(event?: unknown): void;
  /**
   * Drive a `close` the client did not ask for. The default code 1006 is a
   * dropped connection. `wasClean` defaults to `false` for 1006 and `true` for
   * any other code, which a server sends in a close frame.
   */
  simulateClose(code?: number, reason?: string, wasClean?: boolean): void;
}

/**
 * What {@link createFakeWebSocket} returns: a constructor to inject plus access
 * to the instances it creates.
 */
export interface FakeWebSocketController {
  /** Inject as `webSocketConstructor` (createConfig) or `webSocketConstructor` (socket options). */
  WebSocket: WebSocketConstructor;
  /** Every instance created, in construction order. */
  instances: FakeWebSocketInstance[];
  /** The most recently created instance. */
  last(): FakeWebSocketInstance;
}

/**
 * Options for {@link createFakeWebSocket}.
 */
export interface FakeWebSocketOptions {
  /**
   * Whose `close(code, reason)` argument handling to mimic. Default `"browser"`.
   *
   * - `"browser"` — browsers and Node's global `WebSocket`: a client may send only `1000` or `3000`–`4999` and a reason of at most 123 UTF-8 bytes, and a rejected call throws before anything changes, so the connection stays open.
   * - `"ws"` — the `ws` package on an open connection: it also accepts `1001`–`1003` and `1007`–`1014`, and it moves to `CLOSING` before it checks, so a rejected call leaves the connection stuck. Every later `close()` is ignored and no close event fires.
   *
   * In both modes an accepted call closes at once and fires the close event synchronously.
   */
  closeHandling?: "browser" | "ws";
}

/** Throw the way a browser's `close(code, reason)` rejects arguments a client must not send. */
function assertBrowserCloseArguments(code?: number, reason?: string): void {
  if (code !== undefined && code !== 1000 && (code < 3000 || code > 4999)) {
    throw new DOMException(`The close code ${code} is neither 1000 nor in the range 3000-4999.`, "InvalidAccessError");
  }
  if (reason !== undefined && new TextEncoder().encode(reason).length > 123) {
    throw new DOMException("The close reason is longer than 123 UTF-8 bytes.", "SyntaxError");
  }
}

/**
 * Throw the way the `ws` package's `close(code, reason)` rejects arguments
 * (`lib/sender.js` with `isValidStatusCode` from `lib/validation.js`). It
 * ignores `reason` when no `code` is given.
 */
function assertWsCloseArguments(code?: number, reason?: string): void {
  if (code === undefined) return;
  const isValidCode =
    (code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) || (code >= 3000 && code <= 4999);
  if (!isValidCode) throw new TypeError("First argument must be a valid error code number");
  if (reason !== undefined && new TextEncoder().encode(reason).length > 123) {
    throw new RangeError("The message must not be greater than 123 bytes");
  }
}

/**
 * Build an isolated fake WebSocket implementation for a single test. Each call
 * returns its own constructor + instance list, so tests never share socket state.
 *
 * @param options - Which implementation's close handling to mimic.
 */
export function createFakeWebSocket(options?: FakeWebSocketOptions): FakeWebSocketController {
  const closeHandling = options?.closeHandling ?? "browser";
  const instances: FakeWebSocketInstance[] = [];

  class FakeSocket implements FakeWebSocketInstance {
    url: string;
    sent: string[] = [];
    closeCalls: [code?: number, reason?: string][] = [];
    readyState: number = SOCKET_READY_STATE.CONNECTING;
    onopen: WebSocketLike["onopen"] = null;
    onclose: WebSocketLike["onclose"] = null;
    onerror: WebSocketLike["onerror"] = null;
    onmessage: WebSocketLike["onmessage"] = null;

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }

    send(data: string): void {
      this.sent.push(data);
    }

    close(...args: [code?: number, reason?: string]): void {
      this.closeCalls.push(args);
      const [code, reason] = args;
      if (closeHandling === "ws") {
        if (this.readyState === SOCKET_READY_STATE.CLOSING || this.readyState === SOCKET_READY_STATE.CLOSED) return;
        this.readyState = SOCKET_READY_STATE.CLOSING;
        assertWsCloseArguments(code, reason);
      } else {
        assertBrowserCloseArguments(code, reason);
      }
      this.readyState = SOCKET_READY_STATE.CLOSED;
      this.onclose?.({ code: code ?? 1000, reason: reason ?? "", wasClean: true });
    }

    simulateOpen(): void {
      this.readyState = SOCKET_READY_STATE.OPEN;
      this.onopen?.({});
    }

    simulateMessage(data: unknown): void {
      this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
    }

    simulateError(event?: unknown): void {
      this.onerror?.(event ?? new Error("ws error"));
    }

    simulateClose(code = 1006, reason = "", wasClean = code !== 1006): void {
      this.readyState = SOCKET_READY_STATE.CLOSED;
      this.onclose?.({ code, reason, wasClean });
    }
  }

  return {
    WebSocket: FakeSocket as unknown as WebSocketConstructor,
    instances,
    last: () => instances[instances.length - 1]!,
  };
}
