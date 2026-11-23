import { GaslessFeeSource, SymmError, SymmioSupportedChainId } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useGaslessBatchFunding } from "./use-gasless-batch-funding";
import { useGaslessMarginFunding } from "./use-gasless-margin-funding";

const ACCOUNT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const VA = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const quote = {
  collateralToken: "0x000000000000000000000000000000000000c011",
  collateralDecimals: 6,
  blockNumber: 1n,
  timestamp: 2n,
  exact: false,
  totalFee18: 5n,
  totalDebit18: 5n,
  freeOpsApplied: 0n,
  nativeSponsored: false,
  payments: [
    {
      account: ACCOUNT,
      payer: ACCOUNT,
      source: GaslessFeeSource.SYMMIO_ACCOUNT,
      operationalFee18: 5n,
      depositFee18: 0n,
      walletCreationFee18: 0n,
      nativeTopUpFee18: 0n,
      nativeGasCollateral18: 0n,
    },
  ],
};
function setup(): ReturnType<typeof createMockSymmioConfig> & { getBlockNumber: Mock } {
  const mocks = createMockSymmioConfig({ withWallet: false });
  const getBlockNumber = vi.fn().mockResolvedValue(100n);
  Object.assign(mocks.config.getClient({ chainId: SymmioSupportedChainId.ARBITRUM }), { getBlockNumber });
  mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === "previewFeeQuote") return quote;
    if (functionName === "balanceOf") return 100n;
    if (functionName === "balanceInfoOfPartyA") return [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    if (functionName === "getOperationalFeeAllowance") return [10n ** 30n, 0n, 0n, 10_000n];
    throw new Error(`Unexpected read: ${functionName}`);
  });
  return { ...mocks, getBlockNumber };
}
function input(amount18 = 100n) {
  return {
    account: ACCOUNT,
    parentAccount: ACCOUNT,
    virtualAccount: VA,
    direction: "add" as const,
    amount18,
    calls: [{ functionName: "addMargin", args: [VA, amount18] }],
  };
}

describe("funding hooks", () => {
  it("exposes the core margin result without a wallet client", async () => {
    const { config, writeContract, getBlockNumber, readContract } = setup();
    const { result } = renderHookWithProviders(() => useGaslessMarginFunding({ config, ...input() }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      hasSufficientBalance: false,
      hasSufficientAllowance: true,
      isCovered: false,
      maxAddAmount18: 95n,
    });
    expect(result.current.data?.payers[0]?.missing).toEqual(["balance"]);
    expect(getBlockNumber).toHaveBeenCalledExactlyOnceWith({ cacheTime: 0 });
    const pinnedReads = readContract.mock.calls.filter(([read]) => read.functionName !== "previewFeeQuote");
    // Free balance, allocated balance and fee allowance, all at the same block.
    expect(pinnedReads.map(([read]) => read.blockNumber)).toEqual([100n, 100n, 100n]);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("forwards generic movements to the core batch read", async () => {
    const { config } = setup();
    const { result } = renderHookWithProviders(() =>
      useGaslessBatchFunding({
        config,
        account: ACCOUNT,
        calls: input().calls,
        balanceChanges: [{ account: ACCOUNT, delta18: -100n }],
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.payers[0]).toMatchObject({ projectedBalance18: 0n, shortfall18: 5n });
  });

  it("honors enabled:false, refetches on demand, and does not reuse a different amount's result", async () => {
    const { config, readContract } = setup();
    const { result, rerender } = renderHookWithProviders(
      ({ amount18 }: { amount18: bigint }) =>
        useGaslessMarginFunding({ config, ...input(amount18), query: { enabled: false } }),
      { initialProps: { amount18: 100n } },
    );
    // Observe data before fetching, as a rendering consumer does (TanStack tracks accessed properties).
    expect(result.current.data).toBeUndefined();
    expect(readContract).not.toHaveBeenCalled();
    await act(async () => {
      const refreshed = await result.current.refetch();
      expect(refreshed.error).toBeNull();
      expect(refreshed.data?.hasSufficientBalance).toBe(false);
    });
    await waitFor(() => expect(result.current.data?.hasSufficientBalance).toBe(false));
    rerender({ amount18: 95n });
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data?.hasSufficientBalance).toBe(true));
  });

  it("normalizes a failed block lookup without reporting funding success", async () => {
    const { config, getBlockNumber, readContract } = setup();
    getBlockNumber.mockRejectedValue(new Error("Block height unavailable"));
    const { result } = renderHookWithProviders(() => useGaslessMarginFunding({ config, ...input() }));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Block height unavailable");
    expect(result.current.data).toBeUndefined();
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("normalizes a failed batch funding read instead of returning zero funding", async () => {
    const { config, readContract } = setup();
    readContract.mockRejectedValue(new SymmError("api", "GASLESS_FREE_QUOTA_EXHAUSTED", "Quota exhausted"));
    const { result } = renderHookWithProviders(() =>
      useGaslessBatchFunding({ config, account: ACCOUNT, calls: input().calls }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("GASLESS_FREE_QUOTA_EXHAUSTED");
    expect(result.current.data).toBeUndefined();
  });

  it("normalizes quota errors instead of returning zero funding", async () => {
    const { config, readContract } = setup();
    readContract.mockRejectedValue(new SymmError("api", "GASLESS_FREE_QUOTA_EXHAUSTED", "Quota exhausted"));
    const { result } = renderHookWithProviders(() => useGaslessMarginFunding({ config, ...input() }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("GASLESS_FREE_QUOTA_EXHAUSTED");
    expect(result.current.data).toBeUndefined();
  });

  it("honors an explicit target chain over the connected chain", async () => {
    const { config, readContract } = setup();
    const { result } = renderHookWithProviders(() =>
      useGaslessMarginFunding({
        config,
        ...input(),
        chainId: SymmioSupportedChainId.BASE,
      }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("GASLESS_NOT_CONFIGURED");
    expect(readContract).not.toHaveBeenCalled();
  });
});
