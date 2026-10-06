import {
  ListingDepositChainId,
  PoolTransactionStatus,
  PoolTransactionType,
  type GetPoolTransactionsReturnType,
} from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getPoolTransactionsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getPoolTransactionsQueryOptions };
});

import { usePoolTransactions } from "./use-pool-transactions";

const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const WALLET = "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

const PAGE: GetPoolTransactionsReturnType = {
  marketAddress: TOKEN_ADDRESS,
  count: 412,
  items: [
    {
      transactionId: "tx-1",
      tokenAddress: TOKEN_ADDRESS,
      chainId: ListingDepositChainId.BASE,
      walletAddress: WALLET,
      amount: 1000000000000000000n,
      usdcAmount: 1000000000000000000n,
      tokenAmount: 5000000000000000000n,
      transactionHash: "0xdead",
      refundAddress: null,
      refundTransactionHash: null,
      refundTime: null,
      type: PoolTransactionType.DEPOSIT,
      status: PoolTransactionStatus.SUCCESS,
      time: 1772715579,
    },
  ],
};

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  getPoolTransactionsQueryOptions.mockReturnValue({ queryKey: ["getPoolTransactions", {}], enabled, queryFn });
}

describe("usePoolTransactions", () => {
  afterEach(() => {
    getPoolTransactionsQueryOptions.mockReset();
  });

  it("forwards the pool and paging into the core query options and returns the page", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() =>
      usePoolTransactions({ config, tokenAddress: TOKEN_ADDRESS, start: 25, size: 25 }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);
    expect(getPoolTransactionsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ tokenAddress: TOKEN_ADDRESS, start: 25, size: 25, chainId: expect.any(Number) }),
    );
  });

  it("reads pool-wide by default and narrows to one wallet only when asked", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { rerender } = renderHookWithProviders(
      ({ walletAddress }: { walletAddress?: string }) =>
        usePoolTransactions({ config, tokenAddress: TOKEN_ADDRESS, walletAddress }),
      { initialProps: {} as { walletAddress?: string } },
    );

    await waitFor(() => expect(getPoolTransactionsQueryOptions).toHaveBeenCalled());
    const [, poolWide] = getPoolTransactionsQueryOptions.mock.calls[0] as [unknown, { walletAddress?: string }];
    expect(poolWide.walletAddress).toBeUndefined();

    rerender({ walletAddress: WALLET });
    await waitFor(() =>
      expect(getPoolTransactionsQueryOptions).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ walletAddress: WALLET }),
      ),
    );
  });

  it("reads every pool when given no parameters at all", async () => {
    mockOptions(vi.fn().mockResolvedValue({ ...PAGE, marketAddress: null }));

    const { result } = renderHookWithProviders(() => usePoolTransactions());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, options] = getPoolTransactionsQueryOptions.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(options.tokenAddress).toBeUndefined();
    expect(options.marketAddress).toBeUndefined();
    expect(result.current.data!.marketAddress).toBeNull();
  });

  it("passes every filter through to the core query options untouched", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));
    const filters = {
      tokenAddress: TOKEN_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      walletAddress: WALLET,
      transactionType: PoolTransactionType.WITHDRAW,
      transactionStatus: PoolTransactionStatus.PENDING,
      start: 50,
      size: 25,
    };

    renderHookWithProviders(() => usePoolTransactions({ config, ...filters }));

    await waitFor(() =>
      expect(getPoolTransactionsQueryOptions).toHaveBeenCalledWith(config, expect.objectContaining(filters)),
    );
  });

  it("still forwards the deprecated marketAddress, which core folds into tokenAddress", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    renderHookWithProviders(() => usePoolTransactions({ config, marketAddress: TOKEN_ADDRESS }));

    await waitFor(() =>
      expect(getPoolTransactionsQueryOptions).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ marketAddress: TOKEN_ADDRESS }),
      ),
    );
  });

  it("reports the backend's total count, not the page length, so a pager can divide it", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() => usePoolTransactions({ config, tokenAddress: TOKEN_ADDRESS }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.count).toBe(412);
    expect(result.current.data!.items).toHaveLength(1);
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => usePoolTransactions({ config, tokenAddress: TOKEN_ADDRESS }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
