import type {
  GetListingMarketDetailOptions,
  GetUserListingMarketsOptions,
  GetUserProfitOptions,
  GetUserTotalRewardOptions,
  GetUserTransactionsOptions,
  UserListingMarket,
  UserPoolProfit,
} from "@symmio/trading-core";
import { ListingMarketStatus, SymmApiError } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, createTestQueryClient, renderHookWithProviders } from "../test/test-utils";
import { usePoolPortfolio } from "./use-pool-portfolio";
import { useUserProfit } from "./use-user-profit";

const reads = vi.hoisted(() => ({
  catalog: vi.fn(),
  deposits: vi.fn(),
  profit: vi.fn(),
  detail: vi.fn(),
  reward: vi.fn(),
}));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  type Config = Parameters<typeof actual.getUserProfitQueryOptions>[0];
  return {
    ...actual,
    getUserListingMarketsQueryOptions: (c: Config, p: GetUserListingMarketsOptions) => ({
      ...actual.getUserListingMarketsQueryOptions(c, p),
      queryFn: () => reads.catalog(p),
    }),
    getUserTransactionsQueryOptions: (c: Config, p: GetUserTransactionsOptions) => ({
      ...actual.getUserTransactionsQueryOptions(c, p),
      queryFn: () => reads.deposits(p),
    }),
    getUserProfitQueryOptions: (c: Config, p: GetUserProfitOptions) => ({
      ...actual.getUserProfitQueryOptions(c, p),
      queryFn: () => reads.profit(p),
    }),
    getListingMarketDetailQueryOptions: (c: Config, p: GetListingMarketDetailOptions) => ({
      ...actual.getListingMarketDetailQueryOptions(c, p),
      queryFn: () => reads.detail(p),
    }),
    getUserTotalRewardQueryOptions: (c: Config, p: GetUserTotalRewardOptions) => ({
      ...actual.getUserTotalRewardQueryOptions(c, p),
      queryFn: () => reads.reward(p),
    }),
  };
});
const wei = 10n ** 18n;
const profit: UserPoolProfit = {
  userBalanceInTokens: 0n,
  userBalanceInUsdc: 2n * wei,
  userLpAmount: wei,
  availableLpAmount: wei,
  pendingWithdrawLpAmount: 0n,
  userDepositedTokenAmount: wei,
  claimableReward: 3n * wei,
  claimedReward: 4n * wei,
};
function market(address: string, amount = wei, status = ListingMarketStatus.LISTED): UserListingMarket {
  return { contractAddress: address, chainId: 0, marketStatus: status, userDeposit: amount } as UserListingMarket;
}
function catalog(markets: UserListingMarket[]) {
  reads.catalog.mockImplementation(async (p) => {
    const items = markets.filter((row) => row.marketStatus === p.marketStatus);
    return { items, total: items.length };
  });
}
function failure(status: number) {
  return new SymmApiError({
    status,
    code: "FETCH_USER_PROFIT_FAILED",
    statusText: "error",
    message: "failed",
    url: "https://example.test",
    method: "GET",
  });
}
function setup() {
  const { config } = createMockSymmioConfig();
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, retryDelay: 0, staleTime: Infinity } });
  const params = { config, accessToken: "secret", userAddress: "wallet" };
  return { queryClient, params };
}

describe("portfolio hook composition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    catalog([market("Funded"), market("Empty", 0n), market("Refunded", wei, ListingMarketStatus.REJECTED)]);
    reads.deposits.mockResolvedValue({
      items: [
        {
          transactionId: "rejected",
          tokenAddress: "Refunded",
          chainId: 0,
          type: "deposit",
          status: "rejected",
          amount: wei,
        },
        {
          transactionId: "refund",
          tokenAddress: "Refunded",
          chainId: 0,
          type: "deposit",
          status: "refund",
          amount: wei,
        },
      ],
      count: 2,
    });
    reads.profit.mockResolvedValue(profit);
    reads.detail.mockResolvedValue({});
    reads.reward.mockResolvedValue(0n);
  });

  it("keeps refunded rows and complete totals while sharing the primitive cache", async () => {
    const { params, queryClient } = setup();
    const { result } = renderHookWithProviders(
      () => ({
        portfolio: usePoolPortfolio(params),
        profit: useUserProfit({ ...params, tokenContractAddress: "Funded" }),
      }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.portfolio.data).toBeDefined());
    expect(result.current.portfolio.data).toMatchObject({
      totalBalanceUsd: 2,
      claimableRewardUsd: 3,
      claimedRewardUsd: 4,
      gaps: [],
    });
    expect(result.current.portfolio.data?.entries.find((row) => row.tokenContractAddress === "Refunded")).toMatchObject(
      { totalLp: 0n, fullyRefunded: true },
    );
    expect(reads.profit).toHaveBeenCalledTimes(1);
    expect(reads.detail).toHaveBeenCalledTimes(1);
    expect(result.current.profit.data).toEqual(profit);
  });

  it("retries a failing row once even when the query client disables retries", async () => {
    reads.profit.mockRejectedValueOnce(failure(500));
    reads.detail.mockRejectedValueOnce(failure(500));
    const { params, queryClient } = setup();
    const { result } = renderHookWithProviders(() => usePoolPortfolio(params), { queryClient });
    await waitFor(() => expect(result.current.data?.totalBalanceUsd).toBe(2));
    expect(result.current.error).toBeNull();
    expect(reads.profit).toHaveBeenCalledTimes(2);
    expect(reads.detail).toHaveBeenCalledTimes(2);
  });

  it.each([500, 429, 401, 403])("preserves failure %s, with only non-auth failures retried", async (status) => {
    reads.profit.mockRejectedValue(failure(status));
    const { params, queryClient } = setup();
    const { result } = renderHookWithProviders(() => usePoolPortfolio(params), { queryClient });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.totalBalanceUsd).toBeNull();
    expect(result.current.data?.gaps).toContainEqual({
      source: "profit",
      tokenContractAddress: "Funded",
      reason: "failed",
    });
    expect(result.current.error).toMatchObject({ status });
    expect(reads.profit).toHaveBeenCalledTimes(status === 401 || status === 403 ? 1 : 2);
  });

  it("keeps five requests in flight across profit/detail and manual refresh", async () => {
    catalog(Array.from({ length: 12 }, (_, i) => market(String(i))));
    reads.deposits.mockResolvedValue({ items: [], count: 0 });
    let active = 0,
      peak = 0;
    const releases: (() => void)[] = [];
    async function hold() {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
    }
    reads.profit.mockImplementation(async () => {
      await hold();
      return profit;
    });
    reads.detail.mockImplementation(async () => {
      await hold();
      return {};
    });
    const { params, queryClient } = setup();
    const { result } = renderHookWithProviders(() => usePoolPortfolio(params), { queryClient });
    await waitFor(() => expect(active).toBe(5));
    async function drain() {
      await waitFor(async () => {
        await act(async () => {
          releases.splice(0).forEach((release) => release());
        });
        expect(result.current.isFetching).toBe(false);
      });
    }
    await drain();
    expect(result.current.data?.totalBalanceUsd).toBe(24);
    let refreshed: Promise<unknown>;
    act(() => {
      refreshed = result.current.refetch();
    });
    await waitFor(() => expect(active).toBe(5));
    await drain();
    await act(async () => {
      await refreshed;
    });
    expect(peak).toBe(5);
    expect(reads.profit).toHaveBeenCalledTimes(24);
    expect(reads.detail).toHaveBeenCalledTimes(24);
  });

  it("skips all private reads and manual refetch while unauthenticated", async () => {
    const { params, queryClient } = setup();
    const { result } = renderHookWithProviders(() => usePoolPortfolio({ ...params, accessToken: "" }), { queryClient });
    await act(async () => {
      await result.current.refetch();
    });
    expect(reads.catalog).not.toHaveBeenCalled();
    expect(reads.profit).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
