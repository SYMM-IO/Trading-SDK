import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { usePoolStatistics } from "./use-pool-statistics";

const reads = vi.hoisted(() => ({ detail: vi.fn(), reward: vi.fn(), profit: vi.fn(), pending: vi.fn() }));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getListingMarketDetailQueryOptions: (...args: Parameters<typeof actual.getListingMarketDetailQueryOptions>) => ({
      ...actual.getListingMarketDetailQueryOptions(...args),
      queryFn: () => reads.detail(),
    }),
    getPoolRewardChartQueryOptions: (...args: Parameters<typeof actual.getPoolRewardChartQueryOptions>) => ({
      ...actual.getPoolRewardChartQueryOptions(...args),
      queryFn: () => reads.reward(),
    }),
    getUserProfitQueryOptions: (...args: Parameters<typeof actual.getUserProfitQueryOptions>) => ({
      ...actual.getUserProfitQueryOptions(...args),
      queryFn: () => reads.profit(),
    }),
    getPoolTransactionsQueryOptions: (...args: Parameters<typeof actual.getPoolTransactionsQueryOptions>) => ({
      ...actual.getPoolTransactionsQueryOptions(...args),
      queryFn: () => reads.pending(),
    }),
  };
});

describe("statistics source scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    reads.detail.mockResolvedValue({ symbolId: null, totalUsdcInPool: 10n, apy: {}, rewards: {} });
    reads.reward.mockResolvedValue([]);
    reads.profit.mockResolvedValue({ userBalanceInUsdc: 2n });
    reads.pending.mockResolvedValue({ items: [], count: 0 });
  });

  it("never fetches the pool-wide withdrawal queue when refreshing personal statistics", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      usePoolStatistics({
        config,
        tokenContractAddress: "Mint",
        depositChain: 0,
        scope: "user",
        accessToken: "token",
        userAddress: "wallet",
      }),
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    await act(async () => {
      await result.current.refetch();
    });
    expect(reads.pending).not.toHaveBeenCalled();
    expect(reads.profit).toHaveBeenCalledTimes(2);
    expect(result.current.data?.pendingUsd).toBeNull();
  });

  it("does not bypass authentication on an explicit refresh", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      usePoolStatistics({
        config,
        tokenContractAddress: "Mint",
        depositChain: 0,
        scope: "user",
        accessToken: "",
        userAddress: "wallet",
      }),
    );
    await act(async () => {
      await result.current.refetch();
    });
    for (const read of Object.values(reads)) expect(read).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
