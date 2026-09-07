import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";

const get = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { get },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { getGaslessRequest } from "./get-gasless-request";

const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" };

describe("getGaslessRequest", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("fetches the operations record and normalizes it", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({
      headers: HEADERS,
      data: {
        id: "req-1",
        user_address: "0xuser",
        operation_type: "initiateWithdraw",
        payload: {},
        status: "submitted",
        tx_hash: "0xabc",
        error_code: null,
        error_message: null,
        idempotency_key: "key-1",
        created_at: "2026-09-04T00:00:00Z",
        updated_at: "2026-09-04T00:00:01Z",
      },
    });

    const request = await getGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });

    expect(get).toHaveBeenCalledWith(
      "/req-1",
      expect.objectContaining({
        baseURL: "https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/operations",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
    expect(request).toEqual({
      requestId: "req-1",
      status: GaslessRequestStatus.SUBMITTED,
      txHash: "0xabc",
      errorCode: null,
      errorMessage: null,
      operationType: "initiateWithdraw",
      idempotencyKey: "key-1",
    });
  });

  it("normalizes a deposits record (request_id key) when service is deposits", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({
      headers: HEADERS,
      data: {
        request_id: "dep-1",
        wallet_address: "0xwallet",
        deposit_address: "0xvault",
        payload: {},
        status: "rejected",
        error_code: "DEPOSIT_BELOW_MINIMUM",
        error_message: "underfunded",
      },
    });

    const request = await getGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      requestId: "dep-1",
      service: "deposits",
    });

    expect(get).toHaveBeenCalledWith(
      "/dep-1",
      expect.objectContaining({
        baseURL: "https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/deposits",
      }),
    );
    expect(request.requestId).toBe("dep-1");
    expect(request.status).toBe(GaslessRequestStatus.REJECTED);
    expect(request.errorCode).toBe("DEPOSIT_BELOW_MINIMUM");
    expect(request.operationType).toBeNull();
  });

  it("throws on an unknown status value instead of polling forever", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({
      headers: HEADERS,
      data: { id: "req-1", user_address: "0x", operation_type: "x", payload: {}, status: "mystery" },
    });

    await expect(getGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" })).rejects.toThrowError(
      /GASLESS_STATUS_UNKNOWN|mystery/,
    );
  });

  it("fails closed when the response reports a different protocol instance", async () => {
    const { config } = gaslessTestConfig();
    get.mockResolvedValue({
      headers: { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe-stage" },
      data: { id: "req-1", user_address: "0x", operation_type: "x", payload: {}, status: "queued" },
    });

    await expect(getGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" })).rejects.toThrowError(
      /GASLESS_INSTANCE_MISMATCH|pins/,
    );
  });

  it("normalizes HTTP failures into SymmApiError with the status preserved", async () => {
    const { config } = gaslessTestConfig();
    get.mockRejectedValue({
      isAxiosError: true,
      message: "not found",
      response: { status: 404, statusText: "Not Found", data: { detail: { code: "NOT_FOUND" } } },
      config: { url: "/req-1", method: "get" },
    });

    const promise = getGaslessRequest(config, { chainId: GASLESS_TEST_CHAIN, requestId: "req-1" });
    await expect(promise).rejects.toBeInstanceOf(SymmApiError);
    await promise.catch((err: SymmApiError) => {
      expect(err.status).toBe(404);
      expect(err.code).toBe("GASLESS_STATUS_FETCH_FAILED");
    });
  });
});
