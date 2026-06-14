import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { createReconnectingSocket } from "./create-reconnecting-socket";
import type { SocketStatus } from "./socket-status";

const URL = "wss://example.test/ws";

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
});
