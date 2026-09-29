import { describe, expect, it } from "vitest";
import { TEST_GASLESS, TEST_GASLESS_TX_HASH } from "../../gasless/test/config";
import { GaslessRequestStatus } from "../../gasless/types";
import {
  buildGaslessSubscribeCommand,
  buildGaslessUnsubscribeCommand,
  gaslessStreamSelectorKey,
  parseGaslessStreamMessage,
} from "./parse-gasless-stream-message";

const INSTANCE = TEST_GASLESS.protocolInstance as string;
const REQUEST_ID = "3f1d2c4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function frame(value: unknown): string {
  return JSON.stringify(value);
}

describe("parseGaslessStreamMessage", () => {
  it("reads the ready handshake and its subscription cap", () => {
    const message = parseGaslessStreamMessage(
      frame({ type: "ready", protocol_instance: INSTANCE, max_subscriptions: 50 }),
    );

    expect(message).toEqual({ type: "ready", protocolInstance: INSTANCE, maxSubscriptions: 50 });
  });

  it("falls back to a single subscription when ready advertises a nonsense cap", () => {
    const message = parseGaslessStreamMessage(
      frame({ type: "ready", protocol_instance: INSTANCE, max_subscriptions: 0 }),
    );

    expect(message).toMatchObject({ type: "ready", maxSubscriptions: 1 });
  });

  it("normalizes a snapshot through the same mappers as the HTTP reads", () => {
    const message = parseGaslessStreamMessage(
      frame({
        type: "snapshot",
        protocol_instance: INSTANCE,
        subscription: { request_id: REQUEST_ID },
        data: {
          request: {
            id: REQUEST_ID,
            user_address: TEST_GASLESS.gaslessLayerAddress,
            operation_type: "gaslessqWalletExecute",
            status: "submitted",
            tx_hash: TEST_GASLESS_TX_HASH,
            payload: { wallet_ids: ["0", "2"] },
            created_at: "2026-09-18T00:00:00Z",
            updated_at: "2026-09-18T00:00:05Z",
          },
          transactions: [
            { id: "att-1", tx_hash: TEST_GASLESS_TX_HASH, attempt_number: 1, status: "submitted" },
            "not-an-attempt",
          ],
        },
      }),
    );

    expect(message).toMatchObject({ type: "snapshot", protocolInstance: INSTANCE });
    if (message.type !== "snapshot") throw new Error("expected a snapshot");
    expect(message.selector).toEqual({ kind: "request", requestId: REQUEST_ID });
    expect(message.request).toMatchObject({
      requestId: REQUEST_ID,
      status: GaslessRequestStatus.SUBMITTED,
      walletIds: [0n, 2n],
    });
    /** The unparseable row is dropped; the valid one still arrives. */
    expect(message.transactions).toHaveLength(1);
    expect(message.transactions[0]).toMatchObject({ id: "att-1", attemptNumber: 1 });
  });

  it("keeps the frame when a record cannot be normalized, so the poll fallback can refetch", () => {
    const message = parseGaslessStreamMessage(
      frame({
        type: "update",
        protocol_instance: INSTANCE,
        subscription: { request_id: REQUEST_ID },
        data: { request: { id: REQUEST_ID, status: "teleported", payload: {} }, transactions: [] },
      }),
    );

    expect(message).toMatchObject({ type: "update", request: null, transactions: [] });
  });

  it("treats an envelope placeholder request as no record", () => {
    const message = parseGaslessStreamMessage(
      frame({
        type: "snapshot",
        protocol_instance: INSTANCE,
        subscription: { request_id: REQUEST_ID },
        data: { request: {}, transactions: [] },
      }),
    );

    expect(message).toMatchObject({ type: "snapshot", request: null });
  });

  it("lowercases a tx_hash selector", () => {
    const upper = TEST_GASLESS_TX_HASH.toUpperCase();
    const message = parseGaslessStreamMessage(
      frame({ type: "unsubscribed", protocol_instance: INSTANCE, subscription: { tx_hash: upper } }),
    );

    expect(message).toEqual({
      type: "unsubscribed",
      protocolInstance: INSTANCE,
      selector: { kind: "transaction", txHash: upper.toLowerCase() },
    });
  });

  it("recognizes the gateway throttle notice, which carries no type or instance", () => {
    expect(parseGaslessStreamMessage(frame({ error: "Rate limit exceeded" }))).toEqual({
      type: "throttle",
      message: "Rate limit exceeded",
    });
  });

  it("reads a command error and its selector", () => {
    const message = parseGaslessStreamMessage(
      frame({
        type: "error",
        protocol_instance: INSTANCE,
        code: "NOT_FOUND",
        subscription: { request_id: REQUEST_ID },
      }),
    );

    expect(message).toEqual({
      type: "error",
      protocolInstance: INSTANCE,
      code: "NOT_FOUND",
      selector: { kind: "request", requestId: REQUEST_ID },
    });
  });

  it("classifies heartbeat and pong as transport", () => {
    expect(parseGaslessStreamMessage(frame({ type: "heartbeat", protocol_instance: INSTANCE }))).toEqual({
      type: "transport",
      kind: "heartbeat",
      protocolInstance: INSTANCE,
    });
    expect(parseGaslessStreamMessage(frame({ type: "pong", protocol_instance: INSTANCE }))).toMatchObject({
      type: "transport",
      kind: "pong",
    });
  });

  it("never throws on a malformed frame", () => {
    expect(parseGaslessStreamMessage("{")).toMatchObject({ type: "unparseable" });
    expect(parseGaslessStreamMessage(frame([1, 2]))).toMatchObject({ type: "unparseable" });
    expect(parseGaslessStreamMessage(frame({ type: "wat", protocol_instance: INSTANCE }))).toMatchObject({
      type: "unparseable",
    });
    expect(parseGaslessStreamMessage(new ArrayBuffer(4))).toMatchObject({ type: "unparseable" });
    expect(parseGaslessStreamMessage(frame({ type: "snapshot", protocol_instance: INSTANCE }))).toMatchObject({
      type: "unparseable",
    });
  });
});

describe("stream commands", () => {
  it("builds subscribe and unsubscribe for both selector kinds", () => {
    expect(buildGaslessSubscribeCommand({ kind: "request", requestId: REQUEST_ID })).toBe(
      `{"type":"subscribe","request_id":"${REQUEST_ID}"}`,
    );
    expect(buildGaslessUnsubscribeCommand({ kind: "request", requestId: REQUEST_ID })).toBe(
      `{"type":"unsubscribe","request_id":"${REQUEST_ID}"}`,
    );
    expect(buildGaslessSubscribeCommand({ kind: "transaction", txHash: TEST_GASLESS_TX_HASH })).toBe(
      `{"type":"subscribe","tx_hash":"${TEST_GASLESS_TX_HASH}"}`,
    );
  });

  it("commands stay far below the gateway's 4096-byte limit", () => {
    expect(buildGaslessSubscribeCommand({ kind: "request", requestId: REQUEST_ID }).length).toBeLessThan(4096);
  });

  it("keys selectors distinctly per kind", () => {
    expect(gaslessStreamSelectorKey({ kind: "request", requestId: REQUEST_ID })).toBe(`request:${REQUEST_ID}`);
    expect(gaslessStreamSelectorKey({ kind: "transaction", txHash: TEST_GASLESS_TX_HASH })).toBe(
      `transaction:${TEST_GASLESS_TX_HASH}`,
    );
  });
});
