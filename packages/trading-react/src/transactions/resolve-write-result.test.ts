import type { TransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, TEST_TX_HASH } from "../test/test-utils";
import { resolveWriteResult, TransactionRevertedError } from "./resolve-write-result";

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
