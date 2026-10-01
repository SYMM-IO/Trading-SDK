import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeWebSocket, type FakeWebSocketController } from "../../shared/test/fake-web-socket";
import type { WebSocketConstructor } from "../../shared/types/websocket";
import { createReconnectingSocket, type SocketCloseInfo } from "./create-reconnecting-socket";
import type { SocketStatus } from "./socket-status";

const URL = "wss://example.test/ws";

/**
 * A WebSocket constructor whose first `failures` dials throw synchronously, the
 * way a browser throws on a malformed URL. Later dials construct the fake.
 */
function createFailingWebSocket(fake: FakeWebSocketController, failures: number): WebSocketConstructor {
  let dials = 0;
  return class extends fake.WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      dials += 1;
      if (dials <= failures) throw new Error(`dial ${dials} failed`);
      super(url, protocols);
    }
  };
}

/**
 * A WebSocket stricter than the standard: it rejects every `close` that carries
 * arguments, throwing `rejection` before it changes state, and closes on a bare
 * `close()`.
 */
function createArgumentRejectingWebSocket(fake: FakeWebSocketController, rejection: Error): WebSocketConstructor {
  return class extends fake.WebSocket {
    close(...args: [code?: number, reason?: string]): void {
      if (args.length > 0) throw rejection;
      super.close();
    }
  };
}

/**
 * A WebSocket whose `close()` starts the closing handshake and leaves it in
 * flight, as a real implementation does until the server's close frame
 * arrives. The test completes it with `simulateClose`.
 */
function createSlowClosingWebSocket(fake: FakeWebSocketController): WebSocketConstructor {
  return class extends fake.WebSocket {
    close(): void {
      /** No close event until the test delivers the server's close frame. */
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createReconnectingSocket", () => {
  it("opens, reports status, and sends the open messages on connect", () => {
    const fake = createFakeWebSocket();
    const statuses: SocketStatus[] = [];
    const socket = createReconnectingSocket({
      url: URL,
      webSocketConstructor: fake.WebSocket,
      getOpenMessages: () => ["subscribe"],
      onStatusChange: (status) => statuses.push(status),
    });

    expect(socket.getStatus()).toBe("connecting");
    fake.last().simulateOpen();

    expect(socket.getStatus()).toBe("open");
    expect(statuses).toContain("open");
    expect(fake.last().sent).toEqual(["subscribe"]);
  });

  it("delivers inbound frames to onMessage", () => {
    const fake = createFakeWebSocket();
    const messages: unknown[] = [];
    createReconnectingSocket({ url: URL, webSocketConstructor: fake.WebSocket, onMessage: (d) => messages.push(d) });

    fake.last().simulateOpen();
    fake.last().simulateMessage("hello");

    expect(messages).toEqual(["hello"]);
  });

  it("buffers sends issued before open and flushes them on open", () => {
    const fake = createFakeWebSocket();
    const socket = createReconnectingSocket({ url: URL, webSocketConstructor: fake.WebSocket });

    socket.send("queued");
    expect(fake.last().sent).toEqual([]);

    fake.last().simulateOpen();
    expect(fake.last().sent).toEqual(["queued"]);
  });

  it("reconnects with backoff after an unclean close and re-sends the open messages", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    const socket = createReconnectingSocket({
      url: URL,
      webSocketConstructor: fake.WebSocket,
      getOpenMessages: () => ["subscribe"],
      reconnect: { baseDelayMs: 500 },
      random: () => 1,
    });

    fake.last().simulateOpen();
    expect(fake.instances.length).toBe(1);

    fake.last().simulateClose(1006);
    expect(socket.getStatus()).toBe("reconnecting");

    vi.advanceTimersByTime(500);
    expect(fake.instances.length).toBe(2);

    fake.last().simulateOpen();
    expect(socket.getStatus()).toBe("open");
    expect(fake.last().sent).toEqual(["subscribe"]);
  });

  it("stops permanently on user close without reconnecting", () => {
    const fake = createFakeWebSocket();
    const socket = createReconnectingSocket({ url: URL, webSocketConstructor: fake.WebSocket });

    fake.last().simulateOpen();
    socket.close();
    expect(socket.getStatus()).toBe("closed");

    // A stray close from the discarded socket must not trigger a reconnect.
    fake.last().simulateClose();
    expect(fake.instances.length).toBe(1);
  });

  it("gives up after maxAttempts and reports closed", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    const socket = createReconnectingSocket({
      url: URL,
      webSocketConstructor: fake.WebSocket,
      reconnect: { maxAttempts: 1, baseDelayMs: 100 },
      random: () => 1,
    });

    fake.last().simulateClose(1006); // attempt 0 < 1 → schedule retry
    expect(socket.getStatus()).toBe("reconnecting");

    vi.advanceTimersByTime(100);
    expect(fake.instances.length).toBe(2);

    fake.last().simulateClose(1006); // attempt 1 ≥ maxAttempts → give up
    expect(socket.getStatus()).toBe("closed");
  });

  it("sends a heartbeat frame on interval when enabled", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    createReconnectingSocket({
      url: URL,
      webSocketConstructor: fake.WebSocket,
      heartbeat: { enabled: true, intervalMs: 1_000, message: "ping" },
    });

    fake.last().simulateOpen();
    vi.advanceTimersByTime(1_000);
    expect(fake.last().sent).toContain("ping");
  });

  it("forwards transport errors to onError", () => {
    const fake = createFakeWebSocket();
    const errors: unknown[] = [];
    createReconnectingSocket({ url: URL, webSocketConstructor: fake.WebSocket, onError: (e) => errors.push(e) });

    fake.last().simulateError("boom");
    expect(errors).toEqual(["boom"]);
  });

  it("reports the close code, reason and cleanliness of a dropped connection to onClose", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    const closes: SocketCloseInfo[] = [];
    createReconnectingSocket({
      url: URL,
      webSocketConstructor: fake.WebSocket,
      onClose: (info) => closes.push(info),
    });

    fake.last().simulateOpen();
    fake.last().simulateClose(1006);

    expect(closes).toEqual([{ code: 1006, reason: "", wasClean: false, willReconnect: true }]);
  });

  it("settles to closed without redialing when the server closes and reconnect is disabled", () => {
    vi.useFakeTimers();
    const fake = createFakeWebSocket();
    const closes: SocketCloseInfo[] = [];
    const socket = createReconnectingSocket({
      url: URL,
      webSocketConstructor: fake.WebSocket,
      reconnect: { enabled: false },
      onClose: (info) => closes.push(info),
    });

    fake.last().simulateOpen();
    fake.last().simulateClose(1013, "try again later");

    expect(closes).toEqual([{ code: 1013, reason: "try again later", wasClean: true, willReconnect: false }]);
    expect(socket.getStatus()).toBe("closed");
    expect(vi.getTimerCount()).toBe(0);
  });

  describe("close()", () => {
    it("forwards the code and reason to the underlying socket and reports them to onClose", () => {
      const fake = createFakeWebSocket();
      const closes: SocketCloseInfo[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        onClose: (info) => closes.push(info),
      });

      fake.last().simulateOpen();
      socket.close(4000, "done");

      expect(fake.last().closeCalls).toEqual([[4000, "done"]]);
      expect(closes).toEqual([{ code: 4000, reason: "done", wasClean: true, willReconnect: false }]);
      expect(socket.getStatus()).toBe("closed");
    });

    it("calls the underlying close with no arguments when given none", () => {
      const fake = createFakeWebSocket();
      const socket = createReconnectingSocket({ url: URL, webSocketConstructor: fake.WebSocket });

      fake.last().simulateOpen();
      socket.close();

      expect(fake.last().closeCalls).toEqual([[]]);
    });

    it("acts only on the first call, ignoring a later code", () => {
      const fake = createFakeWebSocket();
      const socket = createReconnectingSocket({ url: URL, webSocketConstructor: fake.WebSocket });

      fake.last().simulateOpen();
      socket.close(4000, "first");
      socket.close(4001, "second");

      expect(fake.last().closeCalls).toEqual([[4000, "first"]]);
    });

    it.each([
      { code: 1000, reason: "x".repeat(123), label: "123 ASCII bytes" },
      { code: 3000, reason: "€".repeat(41), label: "123 bytes in 41 characters" },
      { code: 4999, reason: "", label: "no bytes" },
      { code: undefined, reason: "bye", label: "3 bytes and no code" },
    ])("forwards code $code with a reason of $label unchanged", ({ code, reason }) => {
      const fake = createFakeWebSocket();
      const errors: unknown[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        onError: (e) => errors.push(e),
      });

      fake.last().simulateOpen();
      socket.close(code, reason);

      expect(fake.last().closeCalls).toEqual([[code, reason]]);
      expect(errors).toEqual([]);
      expect(socket.getStatus()).toBe("closed");
    });

    describe.each(["browser", "ws"] as const)("with an implementation that handles close like %s", (closeHandling) => {
      /**
       * Closes an open socket with `code` and `reason` and checks that the
       * implementation only ever saw a bare `close()`, the error was reported,
       * and the connection still closed.
       */
      function expectRejectedAndClosed(code: number, reason: string): void {
        const fake = createFakeWebSocket({ closeHandling });
        const errors: unknown[] = [];
        const closes: SocketCloseInfo[] = [];
        const socket = createReconnectingSocket({
          url: URL,
          webSocketConstructor: fake.WebSocket,
          onError: (e) => errors.push(e),
          onClose: (info) => closes.push(info),
        });

        fake.last().simulateOpen();
        socket.close(code, reason);

        expect(fake.last().closeCalls).toEqual([[]]);
        expect(errors).toEqual([expect.any(RangeError)]);
        expect(closes).toEqual([{ code: 1000, reason: "", wasClean: true, willReconnect: false }]);
        expect(socket.getStatus()).toBe("closed");
      }

      /** 1001 is accepted by `ws` but not by browsers; the socket rejects it for every implementation. */
      it.each([1001, 1005, 2999, 5000, 3000.5, Number.NaN])(
        "rejects code %s before the implementation sees it, and still closes",
        (code) => {
          expectRejectedAndClosed(code, "bye");
        },
      );

      it.each([
        { reason: "x".repeat(124), label: "124 ASCII bytes" },
        { reason: "€".repeat(42), label: "126 bytes in 42 characters" },
      ])("rejects a reason of $label before the implementation sees it, and still closes", ({ reason }) => {
        expectRejectedAndClosed(1000, reason);
      });
    });

    it("still closes, without them, when the implementation rejects arguments the socket accepts", () => {
      const fake = createFakeWebSocket();
      const rejection = new Error("stricter than the standard");
      const errors: unknown[] = [];
      const closes: SocketCloseInfo[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: createArgumentRejectingWebSocket(fake, rejection),
        onError: (e) => errors.push(e),
        onClose: (info) => closes.push(info),
      });

      fake.last().simulateOpen();
      socket.close(4000, "done");

      expect(fake.last().closeCalls).toEqual([[]]);
      expect(errors).toEqual([rejection]);
      expect(closes).toEqual([{ code: 1000, reason: "", wasClean: true, willReconnect: false }]);
      expect(socket.getStatus()).toBe("closed");
    });

    it("delivers no frame once called, even while the connection is still closing", () => {
      const fake = createFakeWebSocket();
      const messages: unknown[] = [];
      const closes: SocketCloseInfo[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: createSlowClosingWebSocket(fake),
        onMessage: (data) => messages.push(data),
        onClose: (info) => closes.push(info),
      });

      fake.last().simulateOpen();
      fake.last().simulateMessage("before");
      socket.close();
      /** A frame the server sent before it saw the close frame. */
      fake.last().simulateMessage("in flight");
      expect(socket.getStatus()).toBe("closing");

      /** The server's close frame completes the handshake. */
      fake.last().simulateClose(1000);

      expect(messages).toEqual(["before"]);
      expect(closes).toEqual([{ code: 1000, reason: "", wasClean: true, willReconnect: false }]);
      expect(socket.getStatus()).toBe("closed");
      expect(fake.instances).toHaveLength(1);
    });

    it("cancels a pending retry when called during the backoff wait", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        reconnect: { baseDelayMs: 500 },
        random: () => 1,
      });

      fake.last().simulateClose(1006);
      expect(socket.getStatus()).toBe("reconnecting");

      socket.close(1000);
      vi.runAllTimers();

      expect(socket.getStatus()).toBe("closed");
      expect(fake.instances).toHaveLength(1);
    });

    it("reports a rejected code even when no connection is open", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const errors: unknown[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        onError: (e) => errors.push(e),
      });

      fake.last().simulateClose(1006);
      socket.close(1005);
      vi.runAllTimers();

      expect(errors).toEqual([expect.any(RangeError)]);
      expect(socket.getStatus()).toBe("closed");
      expect(fake.instances).toHaveLength(1);
    });
  });

  describe("close() from inside a callback", () => {
    it("does not redial when called from onClose", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const closes: SocketCloseInfo[] = [];
      const statuses: SocketStatus[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        onStatusChange: (status) => statuses.push(status),
        onClose: (info) => {
          closes.push(info);
          socket.close();
        },
      });

      fake.last().simulateOpen();
      fake.last().simulateClose(1006);

      /** The drop was reported as retryable; the close inside `onClose` overrides that. */
      expect(closes).toEqual([{ code: 1006, reason: "", wasClean: false, willReconnect: true }]);
      expect(socket.getStatus()).toBe("closed");
      expect(vi.getTimerCount()).toBe(0);

      vi.runAllTimers();
      expect(fake.instances).toHaveLength(1);
      expect(statuses).toEqual(["open", "closed"]);
    });

    it("does not arm a retry when called from onStatusChange as the socket starts reconnecting", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        onStatusChange: (status) => {
          if (status === "reconnecting") socket.close();
        },
      });

      fake.last().simulateOpen();
      fake.last().simulateClose(1006);

      expect(socket.getStatus()).toBe("closed");
      expect(vi.getTimerCount()).toBe(0);

      vi.runAllTimers();
      expect(fake.instances).toHaveLength(1);
    });

    it("does not dial when called from onStatusChange as a retry starts connecting", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        reconnect: { baseDelayMs: 500 },
        random: () => 1,
        onStatusChange: (status) => {
          if (status === "connecting") socket.close();
        },
      });

      fake.last().simulateClose(1006);
      vi.advanceTimersByTime(500);

      expect(fake.instances).toHaveLength(1);
      expect(socket.getStatus()).toBe("closed");
    });

    it("skips onOpen, the open messages and the heartbeat when called from onStatusChange on open", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const onOpen = vi.fn();
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: fake.WebSocket,
        getOpenMessages: () => ["subscribe"],
        heartbeat: { enabled: true, intervalMs: 1_000 },
        onOpen,
        onStatusChange: (status) => {
          if (status === "open") socket.close();
        },
      });

      socket.send("queued");
      fake.last().simulateOpen();

      expect(onOpen).not.toHaveBeenCalled();
      expect(fake.last().sent).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
      expect(socket.getStatus()).toBe("closed");
    });
  });

  describe("a dial that throws", () => {
    it("is reported to onError and retried with backoff", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const errors: unknown[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: createFailingWebSocket(fake, 1),
        reconnect: { baseDelayMs: 500 },
        random: () => 1,
        onError: (e) => errors.push(e),
      });

      expect(errors).toHaveLength(1);
      expect(socket.getStatus()).toBe("reconnecting");

      vi.advanceTimersByTime(500);
      expect(fake.instances).toHaveLength(1);
      expect(socket.getStatus()).toBe("connecting");
    });

    it("settles to closed without a retry when reconnect is disabled", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const errors: unknown[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: createFailingWebSocket(fake, 1),
        reconnect: { enabled: false },
        onError: (e) => errors.push(e),
      });

      expect(errors).toHaveLength(1);
      expect(socket.getStatus()).toBe("closed");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("stops retrying after maxAttempts", () => {
      vi.useFakeTimers();
      const fake = createFakeWebSocket();
      const errors: unknown[] = [];
      const socket = createReconnectingSocket({
        url: URL,
        webSocketConstructor: createFailingWebSocket(fake, Number.POSITIVE_INFINITY),
        reconnect: { maxAttempts: 2, baseDelayMs: 100, jitter: false },
        onError: (e) => errors.push(e),
      });

      vi.runAllTimers();

      /** The first dial plus two retries. */
      expect(errors).toHaveLength(3);
      expect(socket.getStatus()).toBe("closed");
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
