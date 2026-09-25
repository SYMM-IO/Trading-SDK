import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config } from "../../core/config";
import { createFakeWebSocket, type FakeWebSocketController } from "../../shared/test/fake-web-socket";
import { TEST_GASLESS, TEST_GASLESS_TX_HASH } from "../test/config";
import { GaslessRequestStatus } from "../types";

const getGaslessRequest = vi.hoisted(() => vi.fn());
vi.mock("../get-gasless-request/get-gasless-request", () => ({ getGaslessRequest }));

import { waitForGaslessRequest } from "./wait-for-gasless-request";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const INSTANCE = TEST_GASLESS.protocolInstance as string;
const REQUEST_ID = "ea695bdf-3d32-4991-a551-90810518e851";

function readyFrame(): unknown {
  return { type: "ready", protocol_instance: INSTANCE, max_subscriptions: 50 };
}

function recordFrame(kind: "snapshot" | "update", status: string, txHash: string | null): unknown {
  return {
    type: kind,
    protocol_instance: INSTANCE,
    subscription: { request_id: REQUEST_ID },
    data: {
      request: {
        id: REQUEST_ID,
        user_address: TEST_GASLESS.gaslessLayerAddress,
        operation_type: "depositForAccount",
        status,
        tx_hash: txHash,
        payload: {},
        created_at: "2026-09-23T00:00:00Z",
        updated_at: "2026-09-23T00:00:01Z",
      },
      transactions: [],
    },
  };
}

let sockets: FakeWebSocketController;
let config: Config;

beforeEach(() => {
  vi.useFakeTimers();
  getGaslessRequest.mockReset();
  getGaslessRequest.mockRejectedValue(new Error("the stream should have answered"));
  sockets = createFakeWebSocket();
  config = createConfig({
    getClient: () => undefined as never,
    webSocketConstructor: sockets.WebSocket,
    symmioConfig: {
      [CHAIN]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        gasless: { ...TEST_GASLESS, statusStream: { enabled: true } },
      },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the two waits of one relayed write", () => {
  /**
   * The shape a relayed write produces: the dispatcher waits for the broadcast,
   * then the write's receipt tail waits for the terminal. Before the stream led
   * the transport this cost two status reads and a full unsubscribe/resubscribe
   * round trip between them.
   */
  it("shares one socket and one subscription, and reads nothing over HTTP", async () => {
    const broadcast = waitForGaslessRequest(config, { chainId: CHAIN, requestId: REQUEST_ID, until: "broadcast" });
    await vi.advanceTimersByTimeAsync(0);

    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame());
    await vi.advanceTimersByTimeAsync(10);
    socket.simulateMessage(recordFrame("snapshot", "submitted", TEST_GASLESS_TX_HASH));

    const first = await broadcast;
    expect(first.txHash).toBe(TEST_GASLESS_TX_HASH);

    /** The terminal wait starts moments later, inside the subscription's grace. */
    const terminal = waitForGaslessRequest(config, { chainId: CHAIN, requestId: REQUEST_ID, until: "terminal" });
    await vi.advanceTimersByTimeAsync(0);
    socket.simulateMessage(recordFrame("update", "succeeded", TEST_GASLESS_TX_HASH));
    const second = await terminal;

    expect(second.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest).not.toHaveBeenCalled();
    expect(sockets.instances).toHaveLength(1);
    expect(socket.sent).toEqual([`{"type":"subscribe","request_id":"${REQUEST_ID}"}`]);
  });

  it("gives the subscription up once nobody comes back for it", async () => {
    const broadcast = waitForGaslessRequest(config, { chainId: CHAIN, requestId: REQUEST_ID, until: "broadcast" });
    await vi.advanceTimersByTimeAsync(0);

    const socket = sockets.last();
    socket.simulateOpen();
    socket.simulateMessage(readyFrame());
    await vi.advanceTimersByTimeAsync(10);
    socket.simulateMessage(recordFrame("snapshot", "submitted", TEST_GASLESS_TX_HASH));
    await broadcast;

    await vi.advanceTimersByTimeAsync(5_000);
    expect(socket.closeCalls.length).toBeGreaterThan(0);
  });
});
