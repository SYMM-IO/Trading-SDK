import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import {
  ListingMarketStatus,
  PoolTransactionStatus,
  PoolTransactionType,
  type UserListingMarket,
  type UserTransaction,
} from "../types";
import { getPoolPortfolio } from "./get-pool-portfolio";

const reads = vi.hoisted(() => ({ catalog: vi.fn(), deposits: vi.fn(), detail: vi.fn(), reward: vi.fn() }));
vi.mock("../user-markets/get-user-listing-markets", () => ({ getUserListingMarkets: reads.catalog }));
vi.mock("../user-transactions/get-user-transactions", () => ({ getUserTransactions: reads.deposits }));
vi.mock("../market-detail/get-listing-market-detail", () => ({ getListingMarketDetail: reads.detail }));
vi.mock("../rewards/get-user-total-reward", () => ({ getUserTotalReward: reads.reward }));

const wei = 10n ** 18n;
function market(address: string, amount = wei, status = ListingMarketStatus.LISTED): UserListingMarket {
  return { contractAddress: address, chainId: 0, marketStatus: status, userDeposit: amount } as UserListingMarket;
}
function deposit(address: string, status = PoolTransactionStatus.SUCCESS): UserTransaction {
  return {
    tokenAddress: address,
    chainId: 0,
    amount: wei,
    type: PoolTransactionType.DEPOSIT,
    status,
    transactionId: address + status,
  } as UserTransaction;
}
function failure(status: number, errorCode?: number) {
  return { isAxiosError: true, response: { status, data: { error_code: errorCode } } };
}
function fundedResponse() {
  return {
    data: {
      user_balance_in_tokens: "0",
      user_balance_in_usdc: String(2n * wei),
      claimable_reward: "3",
      claimed_reward: String(4n * wei),
      user_lp_amount: String(wei),
      pending_withdraw_lp_amount: "0",
      user_deposited_token_amount: String(wei),
    },
  };
}
function catalog(markets: UserListingMarket[]) {
  reads.catalog.mockImplementation(async (_config, p) => {
    const items = markets.filter((row) => row.marketStatus === p.marketStatus);
    return { items, total: items.length };
  });
}
function run() {
  return getPoolPortfolio(mockConfig().config, { accessToken: "secret", userAddress: "wallet" });
}

describe("portfolio read eligibility and failures", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    catalog([market("Funded"), market("Empty", 0n), market("Refunded", wei, ListingMarketStatus.REJECTED)]);
    reads.deposits.mockResolvedValue({
      items: [
        deposit("Funded"),
        deposit("Refunded", PoolTransactionStatus.REJECTED),
        deposit("Refunded", PoolTransactionStatus.REFUND),
      ],
      count: 3,
    });
    reads.reward.mockResolvedValue(0n);
    reads.detail.mockResolvedValue({});
    vi.spyOn(axios, "get").mockResolvedValue(fundedResponse());
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps refunded history and full totals without profit/detail requests for known non-listed or unfunded pools", async () => {
    const result = await run();
    expect(result).toMatchObject({ totalBalanceUsd: 2, claimableRewardUsd: 3, claimedRewardUsd: 4, gaps: [] });
    expect(result.entries.find((row) => row.tokenContractAddress === "Refunded")).toMatchObject({
      totalLp: 0n,
      fullyRefunded: true,
      refundedToken: wei,
      balanceUsd: 0,
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith("/v2/profit/Funded", expect.anything());
    expect(reads.detail).toHaveBeenCalledTimes(1);
  });

  it("treats an undiscovered non-listed pool's exact 404/22 profit response as zero without a gap", async () => {
    catalog([market("Funded")]);
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (url.endsWith("/Refunded")) throw failure(404, 22);
      return fundedResponse();
    });
    const result = await run();
    expect(result).toMatchObject({ totalBalanceUsd: 2, claimableRewardUsd: 3, claimedRewardUsd: 4, gaps: [] });
    expect(result.entries.find((row) => row.tokenContractAddress === "Refunded")?.fullyRefunded).toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it.each([
    [500, 22],
    [429, undefined],
    [404, 21],
    [0, undefined],
  ])("retries status %s once and retains failed/unknown profit", async (status, code) => {
    vi.mocked(axios.get).mockRejectedValue(failure(status, code));
    const result = await run();
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      totalBalanceUsd: null,
      claimableRewardUsd: null,
      claimedRewardUsd: null,
      gaps: [{ source: "profit", reason: "failed", tokenContractAddress: "Funded" }],
    });
  });

  it("does not mask a 500 from a history-only refunded pool as the expected 404/22", async () => {
    catalog([market("Funded")]);
    vi.mocked(axios.get).mockImplementation(async (url) => {
      if (url.endsWith("/Refunded")) throw failure(500, 22);
      return fundedResponse();
    });
    const result = await run();
    expect(result).toMatchObject({ totalBalanceUsd: null, claimableRewardUsd: null, claimedRewardUsd: null });
    expect(result.gaps).toEqual([{ source: "profit", reason: "failed", tokenContractAddress: "Refunded" }]);
    expect(result.entries.find((row) => row.tokenContractAddress === "Funded")?.balanceUsd).toBe(2);
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it("recovers transient profit and detail failures with one retry each", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(failure(500));
    reads.detail.mockRejectedValueOnce(Error("timeout"));
    expect(await run()).toMatchObject({ totalBalanceUsd: 2, gaps: [] });
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(reads.detail).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])("does not retry authentication failure %s", async (status) => {
    vi.mocked(axios.get).mockRejectedValue(failure(status));
    await expect(run()).rejects.toMatchObject({ status });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it("does not infer zero holdings from failed deposit history", async () => {
    catalog([market("Unknown", 0n)]);
    reads.deposits.mockRejectedValue(Error("timeout"));
    const result = await run();
    expect(axios.get).not.toHaveBeenCalled();
    expect(reads.detail).not.toHaveBeenCalled();
    expect(result.totalBalanceUsd).toBeNull();
    expect(result.entries[0]).toMatchObject({ totalLp: null, hasDeposit: null });
    expect(result.gaps).toContainEqual({ source: "deposits", reason: "failed" });
  });

  it("caps profit and detail requests together at five in flight", async () => {
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
    vi.mocked(axios.get).mockImplementation(async () => {
      await hold();
      return fundedResponse();
    });
    reads.detail.mockImplementation(async () => {
      await hold();
      return {};
    });
    let done = false;
    const pending = run().then((result) => {
      done = true;
      return result;
    });
    await vi.waitFor(() => expect(active).toBe(5));
    while (!done) {
      releases.splice(0).forEach((release) => release());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect((await pending).gaps).toEqual([]);
    expect(peak).toBe(5);
    expect(axios.get).toHaveBeenCalledTimes(12);
    expect(reads.detail).toHaveBeenCalledTimes(12);
  });
});
