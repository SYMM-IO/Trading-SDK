import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { operationRequestFixture } from "../test/records";
import { GaslessRequestStatus, type GaslessRequest } from "../types";

const getGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("../get-gasless-request/get-gasless-request", () => ({ getGaslessRequest }));

import { waitForGaslessRequest } from "./wait-for-gasless-request";

function record(status: GaslessRequestStatus, txHash: GaslessRequest["txHash"] = null): GaslessRequest {
  return operationRequestFixture({ status, txHash, operationType: "initiateWithdraw" });
}

function httpError(status: number, retryAfterMs?: number): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_STATUS_FETCH_FAILED",
    message: `${status}`,
    status,
    statusText: "",
    url: "https://gasless.test",
    method: "GET",
    retryAfterMs,
  });
}

function notFound(): SymmApiError {
  return httpError(404);
}

describe("waitForGaslessRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getGaslessRequest.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls queued → submitted → succeeded with the status-dependent cadence", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest
      .mockResolvedValueOnce(record(GaslessRequestStatus.QUEUED))
      .mockResolvedValueOnce(record(GaslessRequestStatus.SUBMITTED, "0xabc"))
      .mockResolvedValueOnce(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    await vi.advanceTimersByTimeAsync(1_500); // queued cadence
    await vi.advanceTimersByTimeAsync(3_000); // submitted cadence
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(getGaslessRequest).toHaveBeenCalledTimes(3);
  });

  it("resolves at broadcast when until is 'broadcast'", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest
      .mockResolvedValueOnce(record(GaslessRequestStatus.QUEUED))
      .mockResolvedValueOnce(record(GaslessRequestStatus.SUBMITTED, "0xabc"));

    const promise = waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
      until: "broadcast",
    });

    await vi.advanceTimersByTimeAsync(1_500);
    const result = await promise;

    expect(result.txHash).toBe("0xabc");
    expect(result.status).toBe(GaslessRequestStatus.SUBMITTED);
  });

  it("tolerates up to three consecutive 404s right after acceptance", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    await vi.advanceTimersByTimeAsync(1_500);
    await vi.advanceTimersByTimeAsync(1_500);
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
  });

  it("rethrows a fourth consecutive 404", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest.mockRejectedValue(notFound());

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });
    const assertion = expect(promise).rejects.toBeInstanceOf(SymmApiError);

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("throws GASLESS_TERMINAL_TIMEOUT when the budget runs out while queued", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.QUEUED));

    const promise = waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
      timeoutMs: 4_000,
    });
    const assertion = expect(promise).rejects.toThrowError(/GASLESS_TERMINAL_TIMEOUT|did not reach/);

    await vi.advanceTimersByTimeAsync(6_000);
    await assertion;
  });

  it("aborts promptly on the signal", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.QUEUED));
    const controller = new AbortController();

    const promise = waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
      signal: controller.signal,
    });
    const assertion = expect(promise).rejects.toThrowError(SymmError);

    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await assertion;
  });

  it("absorbs a transient 503 instead of reporting the request as failed", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));
    const onTransportIssue = vi.fn();

    const promise = waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
      onTransportIssue,
    });

    /** The backoff is jittered in [0.5 s, 1 s]; a full second covers the band. */
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await promise;

    expect(result.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(onTransportIssue).toHaveBeenCalledTimes(1);
    expect(onTransportIssue.mock.calls[0]?.[0]).toBeInstanceOf(SymmApiError);
  });

  it("waits out the gateway's Retry-After before retrying a 429", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest
      .mockRejectedValueOnce(httpError(429, 20_000))
      .mockResolvedValueOnce(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(getGaslessRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    await expect(promise).resolves.toMatchObject({ status: GaslessRequestStatus.SUCCEEDED });
    expect(getGaslessRequest).toHaveBeenCalledTimes(2);
  });

  it("surfaces a definitive failure at once — a 422 is an answer, not a blind spot", async () => {
    const { config } = gaslessTestConfig();
    const schemaError = httpError(422);
    getGaslessRequest.mockRejectedValue(schemaError);

    const promise = waitForGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });
    const assertion = expect(promise).rejects.toBe(schemaError);

    await vi.advanceTimersByTimeAsync(0);
    await assertion;
  });

  it("times out with the last transient failure as its cause, and never past the budget", async () => {
    const { config } = gaslessTestConfig();
    const transient = httpError(502);
    getGaslessRequest.mockRejectedValue(transient);

    const promise = waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
      timeoutMs: 4_000,
    });
    const assertion = expect(promise).rejects.toMatchObject({
      code: "GASLESS_TERMINAL_TIMEOUT",
      cause: transient,
    });

    /** The backoff would grow past 4 s; the budget caps every sleep, so the timeout still fires. */
    await vi.advanceTimersByTimeAsync(6_000);
    await assertion;
  });

  it("keeps an observer's failure from breaking the wait", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce(record(GaslessRequestStatus.SUCCEEDED, "0xabc"));

    const promise = waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
      onTransportIssue: () => {
        throw new Error("observer blew up");
      },
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(promise).resolves.toMatchObject({ status: GaslessRequestStatus.SUCCEEDED });
  });

  it("forwards its abort signal to the read, so an unmounted poll stops in flight", async () => {
    const { config } = gaslessTestConfig();
    getGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.QUEUED));
    const controller = new AbortController();

    const promise = waitForGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "req-1",
      signal: controller.signal,
    });
    const assertion = expect(promise).rejects.toThrowError(SymmError);

    await vi.advanceTimersByTimeAsync(0);
    expect(getGaslessRequest).toHaveBeenCalledWith(config, expect.objectContaining({ signal: controller.signal }));

    controller.abort();
    await assertion;
  });
});
