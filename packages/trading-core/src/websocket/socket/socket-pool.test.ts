import { describe, expect, it } from "vitest";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { createReconnectingSocket } from "./create-reconnecting-socket";
import { createSocketPool, type PooledSocketHandlers } from "./socket-pool";
import { SOCKET_READY_STATE } from "./socket-status";

const URL = "wss://example.test/ws";

function makeFactory(WebSocket: ReturnType<typeof createFakeWebSocket>["WebSocket"]) {
  return (handlers: PooledSocketHandlers) =>
    createReconnectingSocket({
      url: URL,
      webSocketConstructor: WebSocket,
      onMessage: handlers.onMessage,
      onStatusChange: handlers.onStatusChange,
      onError: handlers.onError,
    });
}

describe("createSocketPool", () => {
  it("shares one socket across listeners and fans out messages", () => {
    const fake = createFakeWebSocket();
    const pool = createSocketPool();
    const factory = makeFactory(fake.WebSocket);

    const a: unknown[] = [];
    const b: unknown[] = [];
    pool.acquire("k", factory, { onMessage: (d) => a.push(d) });
    pool.acquire("k", factory, { onMessage: (d) => b.push(d) });

    expect(fake.instances.length).toBe(1);

    fake.last().simulateOpen();
    fake.last().simulateMessage("m");

    expect(a).toEqual(["m"]);
    expect(b).toEqual(["m"]);
  });

  it("closes the shared socket only after the last listener releases", () => {
    const fake = createFakeWebSocket();
    const pool = createSocketPool();
    const factory = makeFactory(fake.WebSocket);

    const releaseA = pool.acquire("k", factory, {});
    const releaseB = pool.acquire("k", factory, {});
    fake.last().simulateOpen();

    releaseA();
    expect(fake.last().readyState).not.toBe(SOCKET_READY_STATE.CLOSED);

    releaseB();
    expect(fake.last().readyState).toBe(SOCKET_READY_STATE.CLOSED);
  });

  it("syncs the current status to a late joiner", () => {
    const fake = createFakeWebSocket();
    const pool = createSocketPool();
    const factory = makeFactory(fake.WebSocket);

    pool.acquire("k", factory, {});
    fake.last().simulateOpen();

    const seen: string[] = [];
    pool.acquire("k", factory, { onStatusChange: (s) => seen.push(s) });
    expect(seen).toContain("open");
  });
});
