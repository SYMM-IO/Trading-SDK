import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import {
  ListingMarketStatus,
  PoolTransactionStatus,
  PoolTransactionType,
  type UserListingMarket,
  type UserPoolProfit,
  type UserTransaction,
} from "../types";
import { calculatePoolPortfolio, type CalculatePoolPortfolioParameters } from "./calculate-pool-portfolio";
import { getPoolPortfolio } from "./get-pool-portfolio";
const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  deposits: vi.fn(),
  profit: vi.fn(),
  detail: vi.fn(),
  reward: vi.fn(),
}));
vi.mock("../user-markets/get-user-listing-markets", () => ({ getUserListingMarkets: mocks.catalog }));
vi.mock("../user-transactions/get-user-transactions", () => ({ getUserTransactions: mocks.deposits }));
vi.mock("../profit/get-user-profit", () => ({ getUserProfit: mocks.profit }));
vi.mock("../market-detail/get-listing-market-detail", () => ({ getListingMarketDetail: mocks.detail }));
vi.mock("../rewards/get-user-total-reward", () => ({ getUserTotalReward: mocks.reward }));
const wei = 10n ** 18n;
function market(address = "Mint", chainId = 0): UserListingMarket {
  return {
    contractAddress: address,
    chainId,
    marketStatus: ListingMarketStatus.LISTED,
    userDeposit: 5n * wei,
    tokenName: "Token",
    tokenTicker: "TOK",
    symbolId: 1,
    apr: 10n * wei,
  } as UserListingMarket;
}
function deposit(address = "mint", status = PoolTransactionStatus.SUCCESS, amount = 5n * wei): UserTransaction {
  return {
    transactionId: address + status,
    type: PoolTransactionType.DEPOSIT,
    tokenAddress: address,
    chainId: 0,
    status,
    amount,
    tokenDecimals: 6,
  } as UserTransaction;
}
const profit: UserPoolProfit = {
  userBalanceInTokens: 10n * wei,
  userBalanceInUsdc: 0n,
  claimableReward: wei,
  claimedReward: 2n * wei,
  userDepositedTokenAmount: 10n * wei,
  userLpAmount: wei,
  pendingWithdrawLpAmount: 0n,
  availableLpAmount: wei,
};

describe("portfolio review regressions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.catalog.mockResolvedValue({ items: [], total: 0 });
    mocks.deposits.mockResolvedValue({ items: [], count: 0 });
    mocks.profit.mockResolvedValue(profit);
    mocks.detail.mockRejectedValue(new Error("unavailable"));
    mocks.reward.mockResolvedValue(0n);
  });
  it("joins mixed-case Solana backend rows without changing the canonical address", () => {
    expectTypeOf<CalculatePoolPortfolioParameters["listed"]>().toEqualTypeOf<readonly UserListingMarket[]>();
    expectTypeOf<CalculatePoolPortfolioParameters["deposits"]>().toEqualTypeOf<readonly UserTransaction[] | null>();
    const result = calculatePoolPortfolio({
      listed: [market()],
      nonListed: [],
      deposits: [deposit(), deposit("mint", PoolTransactionStatus.REJECTED, 2n * wei)],
      positions: [],
      reward: 0n,
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      tokenContractAddress: "Mint",
      depositedToken: 5n * wei,
      rejectedDepositToken: 2n * wei,
      refundableToken: 7n * wei,
    });
  });
  it("does not merge two distinct exact Solana catalog identities", () => {
    const result = calculatePoolPortfolio({
      listed: [market("Mint"), market("mint")],
      nonListed: [],
      deposits: [deposit("Mint"), deposit("mint", PoolTransactionStatus.REJECTED, 2n * wei)],
      positions: [],
      reward: 0n,
    });
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((row) => row.rejectedDepositToken)).toEqual([0n, 2n * wei]);
  });
  it("never invents a listed status after a failed lookup", async () => {
    mocks.catalog.mockImplementation(async (_config, params) => {
      if (params.marketStatus === ListingMarketStatus.DELISTED) throw Error("unavailable");
      return { items: [], total: 0 };
    });
    mocks.deposits.mockResolvedValue({ items: [deposit()], count: 1 });
    const { config } = mockConfig();
    const result = await getPoolPortfolio(config, { accessToken: "secret", userAddress: "user" });
    expect(result.entries[0]?.marketStatus).toBeNull();
    expect(result.gaps).toContainEqual({ source: ListingMarketStatus.DELISTED, reason: "failed" });
  });
  it("bounds deposits, reports truncation and retains authoritative deposit totals", async () => {
    mocks.catalog.mockImplementation(async (_config, params) => ({
      items: params.marketStatus === ListingMarketStatus.LISTED ? [market()] : [],
      total: params.marketStatus === ListingMarketStatus.LISTED ? 1 : 0,
    }));
    mocks.deposits.mockImplementation(async (_config, params) => ({
      items: Array.from({ length: 100 }, (_, i) => ({ ...deposit(), transactionId: String(params.start + i) })),
      count: 1500,
    }));
    const { config } = mockConfig();
    const result = await getPoolPortfolio(config, { accessToken: "secret", userAddress: "user" });
    expect(mocks.deposits).toHaveBeenCalledTimes(10);
    expect(result.gaps).toContainEqual({ source: "deposits", reason: "truncated" });
    expect(result.entries[0]?.depositedToken).toBe(10n * wei);
    expect(result.entries[0]?.refundableToken).toBeNull();
  });
  it("stops a backend that ignores catalog offset after the repeated page", async () => {
    mocks.catalog.mockResolvedValue({ items: [market()], total: 5000 });
    const { config } = mockConfig();
    const result = await getPoolPortfolio(config, { accessToken: "secret", userAddress: "user" });
    expect(mocks.catalog).toHaveBeenCalledTimes(10);
    expect(result.gaps.filter((gap) => gap.reason === "repeated-page")).toHaveLength(5);
  });
  it("rejects expired sessions rather than presenting them as empty portfolios", async () => {
    mocks.catalog.mockRejectedValue(Object.assign(Error("expired"), { status: 401 }));
    const { config } = mockConfig();
    await expect(getPoolPortfolio(config, { accessToken: "secret", userAddress: "user" })).rejects.toMatchObject({
      status: 401,
    });
  });
  it("does not use search or chain filters on only one source", async () => {
    const { config } = mockConfig();
    await getPoolPortfolio(config, {
      accessToken: "secret",
      userAddress: "user",
      ...{ search: "ignored", chainIds: [0] },
    });
    for (const call of mocks.catalog.mock.calls) {
      expect(call[1]).not.toHaveProperty("search");
      expect(call[1]).not.toHaveProperty("chainIds");
    }
  });
  it("keeps ROI comparable while showing known collateral from an unpriced holding", () => {
    const result = calculatePoolPortfolio({
      listed: [market("A"), market("B")],
      nonListed: [],
      deposits: null,
      positions: [
        { tokenContractAddress: "A", depositChain: 0, profit, detail: null },
        {
          tokenContractAddress: "B",
          depositChain: 0,
          profit: {
            ...profit,
            userBalanceInTokens: 10000n * wei,
            userBalanceInUsdc: 10n * wei,
            userDepositedTokenAmount: 10000n * wei,
          },
          detail: null,
        },
      ],
      prices: [{ tokenContractAddress: "A", depositChain: 0, priceUsd: 2 }],
      reward: 3n * wei,
    });
    expect(result.roiPercent).toBe(0);
    expect(result.totalBalanceUsd).toBe(30);
    expect(result.totalDepositedUsd).toBeNull();
  });
});
