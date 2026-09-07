import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import type { GaslessExecutionConfig } from "../../core/chains/types";
import { createConfig, type Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { GaslessRequestStatus, type GaslessRequest } from "../types";

const waitForGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("../wait-for-gasless-request/wait-for-gasless-request", () => ({ waitForGaslessRequest }));

import { confirmGaslessRequest } from "./confirm-gasless-request";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const TX_HASH = `0x${"ab".repeat(32)}` as const;

function record(status: GaslessRequestStatus, txHash: GaslessRequest["txHash"] = TX_HASH): GaslessRequest {
  return {
    requestId: "req-1",
    status,
    txHash,
    errorCode: null,
    errorMessage: null,
    operationType: "grantDelegation",
    idempotencyKey: null,
  };
}

function buildConfig(overrides?: { execution?: GaslessExecutionConfig }): {
  config: Config;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
} {
  const waitForTransactionReceipt = vi.fn();
  const client = { waitForTransactionReceipt } as unknown as PublicClient;
  const config = createConfig({
    getClient: () => client,
    symmioConfig: {
      [CHAIN]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        ...(overrides?.execution ? { gasless: { execution: overrides.execution } } : {}),
      },
    },
  });
  return { config, waitForTransactionReceipt };
}

describe("confirmGaslessRequest", () => {
  beforeEach(() => {
    waitForGaslessRequest.mockReset();
  });

  it("waits for the receipt on the caller's own client, not the relayer's word", async () => {
    waitForGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED));
    const { config, waitForTransactionReceipt } = buildConfig();
    waitForTransactionReceipt.mockResolvedValue({ blockNumber: 7n, status: "success" });

    const confirmed = await confirmGaslessRequest(config, {
      chainId: CHAIN,
      requestId: "req-1",
      until: "receipt",
      receiptConfirmations: 2,
    });

    expect(waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ hash: TX_HASH, confirmations: 2 }),
    );
    expect(confirmed.txHash).toBe(TX_HASH);
    expect(confirmed.receipt).toEqual({ blockNumber: 7n, status: "success" });
  });

  it("never touches the client when only a terminal status was asked for", async () => {
    waitForGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED));
    const { config, waitForTransactionReceipt } = buildConfig();

    const confirmed = await confirmGaslessRequest(config, { chainId: CHAIN, requestId: "req-1", until: "terminal" });

    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(confirmed.receipt).toBeUndefined();
  });

  it("resolves without a receipt when the receipt wait times out — the relay still succeeded", async () => {
    waitForGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED));
    const { config, waitForTransactionReceipt } = buildConfig();
    waitForTransactionReceipt.mockRejectedValue(new Error("timed out"));

    const confirmed = await confirmGaslessRequest(config, { chainId: CHAIN, requestId: "req-1", until: "receipt" });

    expect(confirmed.request.status).toBe(GaslessRequestStatus.SUCCEEDED);
    expect(confirmed.receipt).toBeUndefined();
  });

  it.each([
    [GaslessRequestStatus.REJECTED, "GASLESS_RELAY_REJECTED"],
    [GaslessRequestStatus.REVERTED, "GASLESS_RELAY_REVERTED"],
    [GaslessRequestStatus.FAILED, "GASLESS_RELAY_FAILED"],
  ])("throws %s as %s with the record attached", async (status, code) => {
    waitForGaslessRequest.mockResolvedValue(record(status));
    const { config } = buildConfig();

    await expect(
      confirmGaslessRequest(config, { chainId: CHAIN, requestId: "req-1", until: "receipt" }),
    ).rejects.toMatchObject({ code, responseData: expect.objectContaining({ status }) });
  });

  it("throws when a succeeded record carries no transaction hash", async () => {
    waitForGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED, null));
    const { config } = buildConfig();

    await expect(confirmGaslessRequest(config, { chainId: CHAIN, requestId: "req-1" })).rejects.toBeInstanceOf(
      SymmError,
    );
  });

  it("forwards the abort signal and the observer to the driver", async () => {
    waitForGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED));
    const { config } = buildConfig();
    const controller = new AbortController();
    const onUpdate = vi.fn();

    await confirmGaslessRequest(config, {
      chainId: CHAIN,
      requestId: "req-1",
      until: "terminal",
      signal: controller.signal,
      onUpdate,
    });

    expect(waitForGaslessRequest).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ until: "terminal", signal: controller.signal, onUpdate }),
    );
  });

  it("reports the terminal on the config's gasless observer", async () => {
    waitForGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED));
    const onEvent = vi.fn();
    const { config } = buildConfig({ execution: { onEvent } });

    await confirmGaslessRequest(config, { chainId: CHAIN, requestId: "req-1", until: "terminal" });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "terminal", requestId: "req-1", status: GaslessRequestStatus.SUCCEEDED }),
    );
  });

  it("survives a throwing observer — an observer must not break the confirmation", async () => {
    waitForGaslessRequest.mockResolvedValue(record(GaslessRequestStatus.SUCCEEDED));
    const { config } = buildConfig({
      execution: {
        onEvent: () => {
          throw new Error("observer blew up");
        },
      },
    });

    await expect(
      confirmGaslessRequest(config, { chainId: CHAIN, requestId: "req-1", until: "terminal" }),
    ).resolves.toMatchObject({ txHash: TX_HASH });
  });

  it("propagates a transport failure from the driver untouched", async () => {
    const transport = new SymmApiError({
      code: "GASLESS_STATUS_FETCH_FAILED",
      message: "boom",
      status: 500,
      statusText: "Server Error",
      url: "https://gasless.test",
      method: "GET",
    });
    waitForGaslessRequest.mockRejectedValue(transport);
    const { config } = buildConfig();

    await expect(confirmGaslessRequest(config, { chainId: CHAIN, requestId: "req-1" })).rejects.toBe(transport);
  });
});
