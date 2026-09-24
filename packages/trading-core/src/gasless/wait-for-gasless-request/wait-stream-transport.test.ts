import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { operationRequestFixture } from "../test/records";
import { GaslessRequestStatus, type GaslessRequest } from "../types";

const getGaslessRequest = vi.hoisted(() => vi.fn());
const watchGaslessRequest = vi.hoisted(() => vi.fn());
const supportsGaslessStatusStream = vi.hoisted(() => vi.fn());

vi.mock("../get-gasless-request/get-gasless-request", () => ({ getGaslessRequest }));
vi.mock("../../websocket/gasless/watch-gasless-request", () => ({
  watchGaslessRequest,
  supportsGaslessStatusStream,
}));

import { waitForGaslessRequest } from "./wait-for-gasless-request";

/** The handlers `watchGaslessRequest` was called with, so a test can drive the stream. */
interface StreamHandle {
  emit: (request: GaslessRequest) => void;
  setLive: (live: boolean) => void;
  unwatch: ReturnType<typeof vi.fn>;
}

function captureStream(): StreamHandle {
  const unwatch = vi.fn();
  const handle: StreamHandle = {
    unwatch,
    emit: () => {
      throw new Error("stream not subscribed yet");
    },
    setLive: () => {
      throw new Error("stream not subscribed yet");
    },
  };
  watchGaslessRequest.mockImplementation((_config: unknown, parameters: Record<string, never>) => {
    const params = parameters as unknown as {
      onUpdate: (update: { kind: "snapshot" | "update"; request: GaslessRequest | null; transactions: [] }) => void;
      onStatusChange?: (status: string, detail: null) => void;
    };
    handle.emit = (request) => params.onUpdate({ kind: "update", request, transactions: [] });
    handle.setLive = (live) => params.onStatusChange?.(live ? "live" : "degraded", null);
    return unwatch;
  });
  return handle;
}

function record(status: GaslessRequestStatus, txHash: GaslessRequest["txHash"] = null): GaslessRequest {
  return operationRequestFixture({ status, txHash, operationType: "initiateWithdraw" });
}

describe("waitForGaslessRequest with the status stream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getGaslessRequest.mockReset();
    watchGaslessRequest.mockReset();
    supportsGaslessStatusStream.mockReset();
    supportsGaslessStatusStream.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves from the stream without reading over HTTP at all, and releases the subscription", async () => {
    const { config } = gaslessTestConfig();
    const stream = captureStream();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.QUEUED));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-stream" });
    await vi.advanceTimersByTimeAsync(0);

    /** The settle window holds the first read while the subscription lands. */
    expect(getGaslessRequest).not.toHaveBeenCalled();
    stream.setLive(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getGaslessRequest).not.toHaveBeenCalled();

    stream.emit(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest).not.toHaveBeenCalled();
    expect(stream.unwatch).toHaveBeenCalledTimes(1);
  });

  it("reads over HTTP once the settle window expires with nothing delivered", async () => {
    const { config } = gaslessTestConfig();
    captureStream();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-settle" });
    await vi.advanceTimersByTimeAsync(900);
    expect(getGaslessRequest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);
  });

  it("reads at once when the stream reports it cannot deliver, without waiting out the window", async () => {
    const { config } = gaslessTestConfig();
    const stream = captureStream();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-degraded-early" });
    await vi.advanceTimersByTimeAsync(0);
    expect(getGaslessRequest).not.toHaveBeenCalled();

    /** `connecting -> degraded` is not a change in "live", but it ends the window. */
    stream.setLive(false);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);
  });

  it("takes one read when a live stream says nothing about the workflow for the stale window", async () => {
    const { config } = gaslessTestConfig();
    const stream = captureStream();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-stale" });
    await vi.advanceTimersByTimeAsync(0);
    stream.setLive(true);

    /** A heartbeat keeps the socket alive without reporting the workflow. */
    await vi.advanceTimersByTimeAsync(14_000);
    expect(getGaslessRequest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);
  });

  it("takes the stream's windows from the deployment's execution config", async () => {
    const { config } = gaslessTestConfig({ execution: { streamSettleMs: 5_000 } });
    captureStream();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-configured" });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(getGaslessRequest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3_500);
    await promise;
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);
  });

  it("resumes polling when the stream stops delivering", async () => {
    const { config } = gaslessTestConfig();
    const stream = captureStream();
    getGaslessRequest
      .mockResolvedValueOnce(record(GaslessRequestStatus.QUEUED))
      .mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-degraded" });
    await vi.advanceTimersByTimeAsync(0);
    stream.setLive(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(getGaslessRequest).not.toHaveBeenCalled();

    /** The socket dropped: the loop goes back to HTTP without losing the workflow. */
    stream.setLive(false);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest.mock.calls.length).toBeGreaterThan(1);
  });

  it("never subscribes when the caller forces polling", async () => {
    const { config } = gaslessTestConfig();
    captureStream();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    await waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-poll",
      transport: "poll",
    });

    expect(watchGaslessRequest).not.toHaveBeenCalled();
  });

  it("polls as before when the deployment has no stream", async () => {
    const { config } = gaslessTestConfig();
    captureStream();
    supportsGaslessStatusStream.mockReturnValue(false);
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const result = await waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-no-stream" });

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(watchGaslessRequest).not.toHaveBeenCalled();
  });

  it("keeps polling when subscribing throws", async () => {
    const { config } = gaslessTestConfig();
    watchGaslessRequest.mockImplementation(() => {
      throw new Error("stream endpoint misconfigured");
    });
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const result = await waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-throw" });

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
  });
});
