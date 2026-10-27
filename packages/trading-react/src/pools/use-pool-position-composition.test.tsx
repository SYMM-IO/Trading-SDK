import type {
  GetListingMarketDetailParameters,
  GetUserProfitParameters,
  GetUserTransactionsParameters,
  ListingMarketDetail,
  UserPoolProfit,
} from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, createTestQueryClient, renderHookWithProviders } from "../test/test-utils";
import { usePoolPosition } from "./use-pool-position";
import { useUserProfit } from "./use-user-profit";
import { useUserTransactions } from "./use-user-transactions";
const reads = vi.hoisted(() => ({ profit: vi.fn(), detail: vi.fn(), deposits: vi.fn() }));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  type Config = Parameters<typeof actual.getUserProfitQueryOptions>[0];
  return {
    ...actual,
    getUserProfitQueryOptions: (config: Config, p: GetUserProfitParameters) => ({
      ...actual.getUserProfitQueryOptions(config, p),
      queryFn: () => reads.profit(p),
    }),
    getListingMarketDetailQueryOptions: (config: Config, p: GetListingMarketDetailParameters) => ({
      ...actual.getListingMarketDetailQueryOptions(config, p),
      queryFn: () => reads.detail(p),
    }),
    getUserTransactionsQueryOptions: (config: Config, p: GetUserTransactionsParameters) => ({
      ...actual.getUserTransactionsQueryOptions(config, p),
      queryFn: () => reads.deposits(p),
    }),
  };
});
const profit: UserPoolProfit = {
  userBalanceInTokens: 9n,
  userBalanceInUsdc: 6n,
  userLpAmount: 3n,
  pendingWithdrawLpAmount: 1n,
  availableLpAmount: 2n,
  userDepositedTokenAmount: 9n,
  claimableReward: 0n,
  claimedReward: 0n,
};
describe("position hook composition", () => {
  it("recalculates withdrawal selection without refetching shared sources", async () => {
    const { config } = createMockSymmioConfig();
    const queryClient = createTestQueryClient();
    let withdrawalPercent = 50;
    const { result, rerender } = renderHookWithProviders(
      () =>
        usePoolPosition({
          config,
          accessToken: "secret",
          userAddress: "wallet",
          tokenContractAddress: "Mint",
          depositChain: 0,
          withdrawalPercent,
        }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.data?.withdrawalLpAmount).toBe(1n));
    withdrawalPercent = 100;
    rerender();
    await waitFor(() => expect(result.current.data?.withdrawalLpAmount).toBe(2n));
    expect(reads.profit).toHaveBeenCalledTimes(1);
    expect(reads.detail).toHaveBeenCalledTimes(1);
    expect(reads.deposits).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    vi.resetAllMocks();
    reads.profit.mockResolvedValue(profit);
    reads.detail.mockResolvedValue({ totalUsdcInPool: 12n } as ListingMarketDetail);
    reads.deposits.mockResolvedValue({ items: [], count: 0 });
  });
  it("shares the existing profit and transaction cache without changing their data shape", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => ({
      position: usePoolPosition({
        config,
        accessToken: "secret",
        userAddress: "wallet",
        tokenContractAddress: "Mint",
        depositChain: 0,
      }),
      profit: useUserProfit({ config, accessToken: "secret", userAddress: "wallet", tokenContractAddress: "Mint" }),
      transactions: useUserTransactions({
        config,
        accessToken: "secret",
        userAddress: "wallet",
        tokenAddress: "Mint",
        transactionType: "deposit" as GetUserTransactionsParameters["transactionType"],
        start: 0,
        size: 100,
      }),
    }));
    await waitFor(() => expect(result.current.position.data).toBeDefined());
    expect(reads.profit).toHaveBeenCalledTimes(1);
    expect(reads.deposits).toHaveBeenCalledTimes(1);
    expect(result.current.transactions.data).toEqual({ items: [], count: 0 });
    expect(result.current.position.data?.availableToken).toBe(6n);
  });
  it("does not issue private reads while unauthenticated", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      usePoolPosition({
        config,
        accessToken: "",
        userAddress: "wallet",
        tokenContractAddress: "Mint",
        depositChain: 0,
      }),
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(reads.profit).not.toHaveBeenCalled();
    expect(reads.deposits).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
  it("separates wallet keys and discards a late completion from the old wallet", async () => {
    const queryClient = createTestQueryClient();
    let resolveOld: (value: UserPoolProfit) => void = () => {};
    reads.profit.mockImplementation((p: GetUserProfitParameters) =>
      p.userAddress === "old"
        ? new Promise<UserPoolProfit>((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve({ ...profit, userBalanceInTokens: 90n }),
    );
    const { config } = createMockSymmioConfig();
    let userAddress = "old";
    const { result, rerender } = renderHookWithProviders(
      () =>
        usePoolPosition({ config, accessToken: "secret", userAddress, tokenContractAddress: "Mint", depositChain: 0 }),
      { queryClient },
    );
    await waitFor(() => expect(reads.profit).toHaveBeenCalled());
    userAddress = "new";
    rerender();
    await waitFor(() => expect(result.current.data?.totalToken).toBe(90n));
    await act(async () => {
      resolveOld(profit);
    });
    expect(result.current.data?.totalToken).toBe(90n);
  });
});
