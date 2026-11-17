import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN } from "../test/config";
import { FUNDING_ACCOUNT as ACCOUNT, FUNDING_VA as VA, fundingQuote, fundingTestConfig } from "../test/funding";
import { GaslessFeeSource } from "../types";
import { getGaslessBatchFunding } from "./get-gasless-batch-funding";

const input = { chainId: GASLESS_TEST_CHAIN, account: ACCOUNT, calls: [{ functionName: "allocate", args: [1n] }] };

describe("getGaslessBatchFunding", () => {
  it("compares projected free plus allocated funds with the quoted debit without signing", async () => {
    const { config, signTypedData, writeContract } = fundingTestConfig(fundingQuote(), {
      [ACCOUNT]: { free: 100n, allocated: 10n },
    });
    const result = await getGaslessBatchFunding(config, {
      ...input,
      balanceChanges: [{ account: ACCOUNT, delta18: -106n }],
    });
    expect(result.hasSufficientBalance).toBe(false);
    expect(result.payers).toEqual([
      {
        payer: ACCOUNT,
        debit18: 5n,
        freeBalance18: 100n,
        balanceBefore18: 110n,
        projectedBalance18: 4n,
        shortfall18: 1n,
      },
    ]);
    expect(result.quote.totalDebit18).toBe(5n);
    expect(signTypedData).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it.each([
    { movement: "allocation", freeBefore: 10n, allocatedBefore: 0n, allocatedAfter: 10n, debit: 15n },
    { movement: "deallocation", freeBefore: 0n, allocatedBefore: 10n, allocatedAfter: 0n, debit: 5n },
  ])(
    "does not double-count or omit funds during $movement",
    async ({ freeBefore, allocatedBefore, allocatedAfter, debit }) => {
      const row = fundingQuote().payments[0]!;
      const quote = { ...fundingQuote([{ ...row, operationalFee18: debit }]), blockNumber: 1n };
      const { config, readContract, getBlockNumber } = fundingTestConfig(quote);
      readContract.mockImplementation(
        async ({ functionName, blockNumber }: { functionName: string; blockNumber?: bigint }) => {
          if (functionName === "previewFeeQuote") return quote;
          if (functionName === "balanceOf") return freeBefore;
          if (functionName === "balanceInfoOfPartyA") {
            // The allocation changes between latest-state reads, but not within block 100.
            const allocated = blockNumber === 100n ? allocatedBefore : allocatedAfter;
            return [allocated, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
          }
          throw new Error(`Unexpected read: ${functionName}`);
        },
      );

      const result = await getGaslessBatchFunding(config, input);

      expect(result.payers[0]).toMatchObject({
        freeBalance18: freeBefore,
        balanceBefore18: 10n,
        projectedBalance18: 10n,
        shortfall18: debit > 10n ? debit - 10n : 0n,
      });
      expect(result.hasSufficientBalance).toBe(debit <= 10n);
      expect(getBlockNumber).toHaveBeenCalledExactlyOnceWith({ cacheTime: 0 });
      expect(
        readContract.mock.calls
          .filter(([read]) => read.functionName !== "previewFeeQuote")
          .map(([read]) => read.blockNumber),
      ).toEqual([100n, 100n]);
      // The quote's block can be an L1 estimate; use the RPC height for balance reads.
      expect(result.quote.blockNumber).toBe(1n);
    },
  );

  it("pins every payer's balance reads to one block, even if the RPC advances", async () => {
    const row = fundingQuote().payments[0]!;
    const { config, getBlockNumber, readContract } = fundingTestConfig(fundingQuote([row, { ...row, payer: VA }]));
    getBlockNumber.mockResolvedValueOnce(100n).mockResolvedValue(101n);

    await getGaslessBatchFunding(config, input);

    expect(getBlockNumber).toHaveBeenCalledExactlyOnceWith({ cacheTime: 0 });
    const reads = readContract.mock.calls.filter(([read]) => read.functionName !== "previewFeeQuote");
    expect(reads).toHaveLength(4);
    expect(reads.map(([read]) => read.blockNumber)).toEqual([100n, 100n, 100n, 100n]);
  });

  it("propagates a failed snapshot read without falling back to latest balances", async () => {
    const error = new Error("Block height unavailable");
    const { config, getBlockNumber, readContract } = fundingTestConfig();
    getBlockNumber.mockRejectedValue(error);

    await expect(getGaslessBatchFunding(config, input)).rejects.toBe(error);

    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("groups case-insensitive payers, includes every debit component and sums movements", async () => {
    const row = fundingQuote().payments[0]!;
    const upper = ACCOUNT.toUpperCase().replace("0X", "0x") as Address;
    const quote = fundingQuote([
      { ...row, depositFee18: 2n, walletCreationFee18: 3n, nativeTopUpFee18: 4n, nativeGasCollateral18: 6n },
      { ...row, payer: upper },
    ]);
    const { config, readContract } = fundingTestConfig(quote);
    const result = await getGaslessBatchFunding(config, {
      ...input,
      balanceChanges: [
        { account: ACCOUNT, delta18: -80n },
        { account: upper, delta18: 5n },
      ],
    });
    expect(result.hasSufficientBalance).toBe(true);
    expect(result.payers).toHaveLength(1);
    expect(result.payers[0]).toMatchObject({ debit18: 25n, projectedBalance18: 25n, shortfall18: 0n });
    expect(readContract.mock.calls.filter(([read]) => read.functionName === "balanceOf")).toHaveLength(1);
  });

  it("does not use one payer's surplus to cover another payer", async () => {
    const row = fundingQuote().payments[0]!;
    const { config } = fundingTestConfig(fundingQuote([row, { ...row, payer: VA }]), {
      [ACCOUNT]: { free: 1_000n, allocated: 0n },
      [VA]: { free: 0n, allocated: 4n },
    });
    const result = await getGaslessBatchFunding(config, input);
    expect(result.hasSufficientBalance).toBe(false);
    expect(result.payers[1]).toMatchObject({ payer: VA, shortfall18: 1n });
  });

  it("clamps a negative projected balance to zero", async () => {
    const { config } = fundingTestConfig();
    const result = await getGaslessBatchFunding(config, {
      ...input,
      balanceChanges: [{ account: ACCOUNT, delta18: -101n }],
    });
    expect(result.payers[0]).toMatchObject({ projectedBalance18: 0n, shortfall18: 5n });
  });

  it("does not need balance reads for a zero-debit quote", async () => {
    const row = fundingQuote().payments[0]!;
    const { config, readContract, getBlockNumber } = fundingTestConfig(
      fundingQuote([{ ...row, operationalFee18: 0n }]),
      {},
    );
    const result = await getGaslessBatchFunding(config, input);
    expect(result.hasSufficientBalance).toBe(true);
    expect(result.payers).toEqual([]);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(getBlockNumber).not.toHaveBeenCalled();
  });

  it("does not retry unavailable pinned balances at latest", async () => {
    const error = new Error("Snapshot state unavailable");
    const quote = fundingQuote();
    const { config, readContract } = fundingTestConfig(quote);
    readContract.mockImplementation(
      async ({ functionName, blockNumber }: { functionName: string; blockNumber?: bigint }) => {
        if (functionName === "previewFeeQuote") return quote;
        if (blockNumber !== undefined) throw error;
        return functionName === "balanceOf" ? 100n : [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
      },
    );

    await expect(getGaslessBatchFunding(config, input)).rejects.toBe(error);

    const reads = readContract.mock.calls.filter(([read]) => read.functionName !== "previewFeeQuote");
    expect(reads.map(([read]) => read.blockNumber)).toEqual([100n, 100n]);
  });

  it("fails closed for unavailable balances", async () => {
    const { config } = fundingTestConfig(fundingQuote(), {});
    await expect(getGaslessBatchFunding(config, input)).rejects.toThrow("Balance unavailable");
  });

  it.each([new Error("RPC unavailable"), new SymmError("api", "GASLESS_FREE_QUOTA_EXHAUSTED", "Quota exhausted")])(
    "propagates quote failure instead of inventing a free operation: %s",
    async (error) => {
      const { config, readContract } = fundingTestConfig();
      readContract.mockRejectedValue(error);
      await expect(getGaslessBatchFunding(config, input)).rejects.toBe(error);
    },
  );

  it("rejects unsupported wallet-collateral fee sources", async () => {
    const row = fundingQuote().payments[0]!;
    const { config } = fundingTestConfig(fundingQuote([{ ...row, source: GaslessFeeSource.WALLET_COLLATERAL }]));
    await expect(getGaslessBatchFunding(config, input)).rejects.toMatchObject({
      code: "GASLESS_FUNDING_SOURCE_UNSUPPORTED",
    });
  });

  it("rejects an inconsistent quote total before reading balances", async () => {
    const { config, readContract } = fundingTestConfig({ ...fundingQuote(), totalDebit18: 6n });
    await expect(getGaslessBatchFunding(config, input)).rejects.toMatchObject({
      code: "GASLESS_FUNDING_QUOTE_INCONSISTENT",
    });
    expect(readContract).toHaveBeenCalledTimes(1);
  });
});
