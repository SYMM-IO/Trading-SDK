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

  it("resolves from a stream delivery without polling again, and releases the subscription", async () => {
    const { config } = gaslessTestConfig();
    const stream = captureStream();
    getGaslessRequest.mockResolvedValueOnce(record(GaslessRequestStatus.QUEUED));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-stream" });
    await vi.advanceTimersByTimeAsync(0);

    /** The first read happens before the stream is live; then polling stands down. */
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);
    stream.setLive(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);

    stream.emit(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);
    expect(stream.unwatch).toHaveBeenCalledTimes(1);
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
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);

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
