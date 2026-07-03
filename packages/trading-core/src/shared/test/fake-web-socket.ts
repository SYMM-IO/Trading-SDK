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
  /** Drive an `open` event. */
  simulateOpen(): void;
  /** Drive a `message` event; objects are JSON-stringified to mimic the wire. */
  simulateMessage(data: unknown): void;
  /** Drive an `error` event. */
  simulateError(event?: unknown): void;
  /** Drive an unclean `close` (default code 1006), e.g. a dropped connection. */
  simulateClose(code?: number, reason?: string): void;
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
 * Build an isolated fake WebSocket implementation for a single test. Each call
 * returns its own constructor + instance list, so tests never share socket state.
 */
export function createFakeWebSocket(): FakeWebSocketController {
  const instances: FakeWebSocketInstance[] = [];

  class FakeSocket implements FakeWebSocketInstance {
    url: string;
    sent: string[] = [];
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

    close(): void {
      this.readyState = SOCKET_READY_STATE.CLOSED;
      this.onclose?.({ code: 1000, reason: "", wasClean: true });
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

    simulateClose(code = 1006, reason = ""): void {
      this.readyState = SOCKET_READY_STATE.CLOSED;
      this.onclose?.({ code, reason, wasClean: false });
    }
  }

  return {
    WebSocket: FakeSocket as unknown as WebSocketConstructor,
    instances,
    last: () => instances[instances.length - 1]!,
  };
}
