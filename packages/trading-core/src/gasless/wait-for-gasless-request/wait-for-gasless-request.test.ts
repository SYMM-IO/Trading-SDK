import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessRequest } from "../types";

const getGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("../get-gasless-request/get-gasless-request", () => ({ getGaslessRequest }));

import { waitForGaslessRequest } from "./wait-for-gasless-request";

function record(status: GaslessRequestStatus, txHash: GaslessRequest["txHash"] = null): GaslessRequest {
  return {
    requestId: "req-1",
    status,
    txHash,
    errorCode: null,
    errorMessage: null,
    operationType: "initiateWithdraw",
    idempotencyKey: null,
  };
}

function notFound(): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_STATUS_FETCH_FAILED",
    message: "404",
    status: 404,
    statusText: "Not Found",
    url: "https://gasless.test",
    method: "GET",
  });
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
});
