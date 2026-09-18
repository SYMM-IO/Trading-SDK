import {
  SymmError,
  SymmioSupportedChainId,
  type GaslessConfirmedRequest,
  type GaslessRequest,
  type GaslessWriteRequest,
} from "@symmio/trading-core";
import type { Hash, TransactionReceipt } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, TEST_TX_HASH } from "../test/test-utils";

const getGaslessWriteRequest = vi.hoisted(() => vi.fn());
const confirmGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getGaslessWriteRequest, confirmGaslessRequest };
});

import { resolveWriteResult, TransactionRevertedError } from "./resolve-write-result";

/** The hash the relayer actually mined, after replacing its first broadcast. */
const TERMINAL_HASH = `0x${"ab".repeat(32)}` as Hash;
const REQUEST_ID = "req-relayed-1";

/** The registry entry the dispatcher writes when it relays a write. */
function relayedWrite(): GaslessWriteRequest {
  return {
    requestId: REQUEST_ID,
    service: "operations",
    chainId: SymmioSupportedChainId.ARBITRUM,
    protocolInstance: "arbitrum-42161-test",
    broadcastHash: TEST_TX_HASH,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  /** Default: an ordinary wallet-submitted write, which is what every non-relay case below is. */
  getGaslessWriteRequest.mockReturnValue(null);
});

/**
 * Minimal stand-in for a mined receipt. Only `status` is load-bearing here; the
 * rest is carried through verbatim so the assertions can prove the error keeps
 * the receipt a UI would render.
 */
function receipt(status: "success" | "reverted"): TransactionReceipt {
  return { transactionHash: TEST_TX_HASH, blockNumber: 42n, status } as unknown as TransactionReceipt;
}

describe("resolveWriteResult", () => {
  it("returns the hash and the receipt for a mined successful transaction", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    const mined = receipt("success");
    waitForTransactionReceipt.mockResolvedValueOnce(mined);

    const result = await resolveWriteResult(config, TEST_TX_HASH);

    expect(result).toEqual({ hash: TEST_TX_HASH, receipt: mined });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
  });

  it("forwards the chain id and confirmations to the receipt wait", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    waitForTransactionReceipt.mockResolvedValueOnce(receipt("success"));

    await resolveWriteResult(config, TEST_TX_HASH, { confirmations: 3 });

    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 3 });
  });

  it("throws instead of returning when the mined receipt reverted", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    const mined = receipt("reverted");
    waitForTransactionReceipt.mockResolvedValueOnce(mined);

    await expect(resolveWriteResult(config, TEST_TX_HASH)).rejects.toThrow(TransactionRevertedError);
  });

  it("carries the hash and the receipt on the thrown revert error", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    const mined = receipt("reverted");
    waitForTransactionReceipt.mockResolvedValueOnce(mined);

    const error = await resolveWriteResult(config, TEST_TX_HASH).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(TransactionRevertedError);
    const reverted = error as TransactionRevertedError;
    expect(reverted.hash).toBe(TEST_TX_HASH);
    expect(reverted.receipt).toBe(mined);
  });

  it("types the revert as a contract-revert SymmioRequestError so existing consumer branches keep working", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    waitForTransactionReceipt.mockResolvedValueOnce(receipt("reverted"));

    const error = await resolveWriteResult(config, TEST_TX_HASH).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmioRequestError);
    expect(error).toMatchObject({ kind: "contract-revert", code: "TRANSACTION_REVERTED" });
  });

  it("does not wait for a receipt — and so cannot detect a revert — when `waitForReceipt` is false", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();

    const result = await resolveWriteResult(config, TEST_TX_HASH, { waitForReceipt: false });

    expect(result).toEqual({ hash: TEST_TX_HASH });
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
  });
});

describe("resolveWriteResult for a relayed write", () => {
  it("returns the request's terminal hash, not the first broadcast the write handed back", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    const mined = receipt("success");
    getGaslessWriteRequest.mockReturnValue(relayedWrite());
    confirmGaslessRequest.mockResolvedValueOnce({
      request: { requestId: REQUEST_ID } as GaslessRequest,
      txHash: TERMINAL_HASH,
      receipt: mined,
    } satisfies GaslessConfirmedRequest);

    const result = await resolveWriteResult(config, TEST_TX_HASH);

    expect(result).toEqual({
      hash: TERMINAL_HASH,
      receipt: mined,
      gasless: { requestId: REQUEST_ID, broadcastHash: TEST_TX_HASH },
    });
    /** Waiting on the replaced hash would wait forever, so the receipt must not come from it. */
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("follows the relay on its own chain and service, through to a receipt", async () => {
    const { config } = createMockSymmioConfig();
    getGaslessWriteRequest.mockReturnValue(relayedWrite());
    confirmGaslessRequest.mockResolvedValueOnce({
      request: { requestId: REQUEST_ID } as GaslessRequest,
      txHash: TERMINAL_HASH,
    } satisfies GaslessConfirmedRequest);

    await resolveWriteResult(config, TEST_TX_HASH, { confirmations: 3 });

    expect(confirmGaslessRequest).toHaveBeenCalledWith(config, {
      chainId: SymmioSupportedChainId.ARBITRUM,
      requestId: REQUEST_ID,
      service: "operations",
      until: "receipt",
      receiptConfirmations: 3,
    });
  });

  it("reports the relay without following it when `waitForReceipt` is false", async () => {
    const { config } = createMockSymmioConfig();
    getGaslessWriteRequest.mockReturnValue(relayedWrite());

    const result = await resolveWriteResult(config, TEST_TX_HASH, { waitForReceipt: false });

    expect(result).toEqual({ hash: TEST_TX_HASH, gasless: { requestId: REQUEST_ID, broadcastHash: TEST_TX_HASH } });
    expect(confirmGaslessRequest).not.toHaveBeenCalled();
  });

  it("surfaces the relayer's verdict instead of inventing a receipt revert", async () => {
    const { config } = createMockSymmioConfig();
    const verdict = new SymmError("api", "GASLESS_RELAY_REVERTED", "Gasless: the relayed batch reverted.");
    getGaslessWriteRequest.mockReturnValue(relayedWrite());
    confirmGaslessRequest.mockRejectedValueOnce(verdict);

    const error = await resolveWriteResult(config, TEST_TX_HASH).catch((err: unknown) => err);

    expect(error).toBe(verdict);
    expect(error).not.toBeInstanceOf(TransactionRevertedError);
  });
});
