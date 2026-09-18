import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config } from "../../core/config";
import { TEST_GASLESS, TEST_GASLESS_TX_HASH } from "../../gasless/test/config";
import { createFakeWebSocket, type FakeWebSocketController } from "../../shared/test/fake-web-socket";
import { GASLESS_STREAM_BOUNDED_ATTEMPTS } from "./close-code-policy";
import {
  acquireGaslessStreamSelector,
  releaseGaslessStreamSelector,
  type GaslessStreamListener,
} from "./gasless-stream-hub";
import type { GaslessStreamEndpoint } from "./resolve-gasless-stream-url";
import type { GaslessRequestStreamUpdate, GaslessStreamStatus } from "./types";

const INSTANCE = TEST_GASLESS.protocolInstance as string;
const ENDPOINT: GaslessStreamEndpoint = {
  url: `wss://gateway.invalid/v1/instances/${INSTANCE}/operations/ws`,
  protocolInstance: INSTANCE,
  service: "operations",
  chainId: 42161,
};
const REQUEST_ID = "3f1d2c4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const OTHER_REQUEST_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

interface Recorder {
  listener: GaslessStreamListener;
  updates: GaslessRequestStreamUpdate[];
  statuses: GaslessStreamStatus[];
  errors: string[];
}

function recorder(): Recorder {
  const updates: GaslessRequestStreamUpdate[] = [];
  const statuses: GaslessStreamStatus[] = [];
  const errors: string[] = [];
  return {
    updates,
    statuses,
    errors,
    listener: {
      onUpdate: (update) => updates.push(update),
      onStatusChange: (status) => statuses.push(status),
      onError: (error) => errors.push(error.code),
    },
  };
}

function readyFrame(instance = INSTANCE, maxSubscriptions = 50): unknown {
  return { type: "ready", protocol_instance: instance, max_subscriptions: maxSubscriptions };
}

function snapshotFrame(requestId: string, status = "submitted"): unknown {
  return {
    type: "snapshot",
    protocol_instance: INSTANCE,
    subscription: { request_id: requestId },
    data: {
      request: {
        id: requestId,
        user_address: TEST_GASLESS.gaslessLayerAddress,
        operation_type: "gaslessqWalletExecute",
        status,
        tx_hash: TEST_GASLESS_TX_HASH,
        payload: {},
        created_at: "2026-09-18T00:00:00Z",
        updated_at: "2026-09-18T00:00:01Z",
      },
      transactions: [],
    },
  };
}

let sockets: FakeWebSocketController;
let config: Config;

/** Drive past the command pacing (250 ms) and let the queue flush. */
function flushCommands(): void {
  vi.advanceTimersByTime(300);
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets = createFakeWebSocket();
  config = createConfig({
    getClient: () => undefined as never,
    webSocketConstructor: sockets.WebSocket,
    symmioConfig: {
      [SymmioSupportedChainId.ARBITRUM]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        gasless: { ...TEST_GASLESS, statusStream: { enabled: true } },
      },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function subscribe(requestId: string, listener: GaslessStreamListener): () => void {
  return acquireGaslessStreamSelector(config, {
    endpoint: ENDPOINT,
    selector: { kind: "request", requestId },
    listener,
    random: () => 0.5,
  });
}

describe("gasless stream hub", () => {
  it("waits for ready before sending any command", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    const socket = sockets.last();
    socket.simulateOpen();

    flushCommands();
    expect(socket.sent).toEqual([]);

    socket.simulateMessage(readyFrame());
    flushCommands();
    expect(socket.sent).toEqual([`{"type":"subscribe","request_id":"${REQUEST_ID}"}`]);
  });

  it("delivers the snapshot to its selector and reports live", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    sockets.last().simulateOpen();
    sockets.last().simulateMessage(readyFrame());
    flushCommands();
    sockets.last().simulateMessage(snapshotFrame(REQUEST_ID));

    expect(watcher.updates).toHaveLength(1);
    expect(watcher.updates[0]).toMatchObject({ kind: "snapshot" });
    expect(watcher.updates[0]?.request).toMatchObject({ requestId: REQUEST_ID });
    expect(watcher.statuses.at(-1)).toBe("live");
  });

  it("shares one socket across watchers and paces their commands", () => {
    const first = recorder();
    const second = recorder();
    subscribe(REQUEST_ID, first.listener);
    subscribe(OTHER_REQUEST_ID, second.listener);

    expect(sockets.instances).toHaveLength(1);
    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame());

    flushCommands();
    expect(socket.sent).toHaveLength(1);
    /** The second command waits for the first to be acked by its snapshot. */
    socket.simulateMessage(snapshotFrame(REQUEST_ID));
    flushCommands();
    expect(socket.sent).toHaveLength(2);
    expect(socket.sent[1]).toContain(OTHER_REQUEST_ID);
  });

  it("requeues a throttled command instead of tearing down the socket", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame());
    flushCommands();
    expect(socket.sent).toHaveLength(1);

    socket.simulateMessage({ error: "Rate limit exceeded" });
    expect(socket.closeCalls).toEqual([]);

    /** Throttled commands wait at least a second, then go out again. */
    vi.advanceTimersByTime(2_000);
    expect(socket.sent).toHaveLength(2);
    expect(watcher.statuses).not.toContain("disabled");
  });

  it("disables the stream when a frame names another protocol instance", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame("some-other-instance"));

    expect(watcher.statuses.at(-1)).toBe("disabled");
    expect(watcher.errors).toContain("GASLESS_STREAM_INSTANCE_MISMATCH");
    expect(socket.closeCalls.length).toBeGreaterThan(0);
  });

  it("stops dialing for good when the gateway says streams are disabled", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    sockets.last().simulateOpen();
    sockets.last().simulateClose(1008, "streams disabled");

    vi.advanceTimersByTime(60_000);
    expect(sockets.instances).toHaveLength(1);
    expect(watcher.statuses.at(-1)).toBe("disabled");
    expect(watcher.errors).toContain("GASLESS_STREAM_DISABLED");
  });

  it("reconnects with backoff after a capacity close and resubscribes", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    sockets.last().simulateOpen();
    sockets.last().simulateMessage(readyFrame());
    flushCommands();
    sockets.last().simulateMessage(snapshotFrame(REQUEST_ID));
    expect(watcher.statuses.at(-1)).toBe("live");

    sockets.last().simulateClose(1013, "capacity");
    expect(watcher.statuses.at(-1)).toBe("degraded");

    vi.advanceTimersByTime(2_000);
    expect(sockets.instances).toHaveLength(2);
    sockets.last().simulateOpen();
    sockets.last().simulateMessage(readyFrame());
    flushCommands();
    expect(sockets.last().sent).toEqual([`{"type":"subscribe","request_id":"${REQUEST_ID}"}`]);
  });

  it("gives up after bounded attempts that never reach ready", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);

    for (let attempt = 0; attempt < GASLESS_STREAM_BOUNDED_ATTEMPTS + 1; attempt += 1) {
      sockets.last().simulateOpen();
      sockets.last().simulateClose(1006);
      vi.advanceTimersByTime(40_000);
    }

    expect(watcher.statuses.at(-1)).toBe("disabled");
    expect(sockets.instances.length).toBeLessThanOrEqual(GASLESS_STREAM_BOUNDED_ATTEMPTS + 1);
  });

  it("retries a NOT_FOUND selector for the accept race, then falls back to polling", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame());
    flushCommands();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      socket.simulateMessage({
        type: "error",
        protocol_instance: INSTANCE,
        code: "NOT_FOUND",
        subscription: { request_id: REQUEST_ID },
      });
      vi.advanceTimersByTime(2_000);
    }

    expect(socket.sent.length).toBeGreaterThan(1);
    expect(watcher.errors).toContain("GASLESS_STREAM_NOT_FOUND");
    expect(watcher.statuses.at(-1)).toBe("degraded");
  });

  it("keeps a selector over the cap on HTTP until a slot frees", () => {
    const first = recorder();
    const second = recorder();
    const releaseFirst = subscribe(REQUEST_ID, first.listener);
    subscribe(OTHER_REQUEST_ID, second.listener);

    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame(INSTANCE, 1));
    flushCommands();

    expect(socket.sent).toHaveLength(1);
    expect(second.statuses.at(-1)).toBe("degraded");

    socket.simulateMessage(snapshotFrame(REQUEST_ID));
    releaseFirst();
    flushCommands();
    /** The freed slot's subscribe waits for the unsubscribe to be acked first. */
    expect(socket.sent.at(-1)).toBe(`{"type":"unsubscribe","request_id":"${REQUEST_ID}"}`);
    socket.simulateMessage({
      type: "unsubscribed",
      protocol_instance: INSTANCE,
      subscription: { request_id: REQUEST_ID },
    });
    flushCommands();
    expect(socket.sent.some((frame) => frame.includes(OTHER_REQUEST_ID))).toBe(true);
  });

  it("unsubscribes a terminal workflow and closes once the last watcher leaves", () => {
    const watcher = recorder();
    const release = subscribe(REQUEST_ID, watcher.listener);
    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame());
    flushCommands();
    socket.simulateMessage(snapshotFrame(REQUEST_ID));

    releaseGaslessStreamSelector(config, ENDPOINT.url, { kind: "request", requestId: REQUEST_ID });
    flushCommands();
    expect(socket.sent.at(-1)).toBe(`{"type":"unsubscribe","request_id":"${REQUEST_ID}"}`);

    release();
    vi.advanceTimersByTime(IDLE_MS);
    expect(socket.closeCalls.length).toBeGreaterThan(0);
  });

  it("keeps the socket through a quick unsubscribe and resubscribe (StrictMode remount)", () => {
    const first = recorder();
    const release = subscribe(REQUEST_ID, first.listener);
    sockets.last().simulateOpen();
    sockets.last().simulateMessage(readyFrame());

    release();
    vi.advanceTimersByTime(500);
    const second = recorder();
    subscribe(REQUEST_ID, second.listener);
    vi.advanceTimersByTime(5_000);

    expect(sockets.instances).toHaveLength(1);
    expect(sockets.last().closeCalls).toEqual([]);
  });

  it("redials when heartbeats stop", () => {
    const watcher = recorder();
    subscribe(REQUEST_ID, watcher.listener);
    sockets.last().simulateOpen();
    sockets.last().simulateMessage(readyFrame());
    flushCommands();
    sockets.last().simulateMessage(snapshotFrame(REQUEST_ID));

    vi.advanceTimersByTime(61_000);
    expect(watcher.statuses.at(-1)).toBe("degraded");
    vi.advanceTimersByTime(5_000);
    expect(sockets.instances.length).toBeGreaterThan(1);
  });
});

/** The hub's idle grace period before it closes an unwatched socket. */
const IDLE_MS = 2_500;
