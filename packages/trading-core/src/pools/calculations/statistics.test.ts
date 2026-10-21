import { describe, expect, it } from "vitest";
import { ListingMarketStatus } from "../types";
import { assemblePoolPortfolio } from "./portfolio";
import { getPoolPortfolioTotals } from "./portfolio-totals";
import { getPoolStatistics, sumPoolPendingWithdrawals } from "./statistics";

const wei = (amount: number) => String(BigInt(Math.round(amount * 1e18)));

describe("pool statistics parity", () => {
  it("keeps unknown balances distinct from reported zero", () => {
    expect(getPoolStatistics({ shareFraction: 1 })).toMatchObject({
      tvl: null,
      tokenAmount: undefined,
      tokenUsdValue: undefined,
      tokenPercent: 50,
    });
    expect(
      getPoolStatistics({ shareFraction: 1, detail: { tvl: "0", totalToken: "0", totalUsdc: "0" } }),
    ).toMatchObject({ tvl: 0, tokenAmount: 0, tokenUsdValue: 0 });
  });
  it("uses latest chart rewards, listing TVL and hedger volume with independent source precedence", () => {
    const result = getPoolStatistics({
      shareFraction: 0.25,
      listing: { tvl: wei(100), volume24h: wei(900), apr30d: "20", reward24h: wei(4) },
      detail: { tvl: wei(90), totalUsdc: wei(10), totalToken: wei(40), apy30d: wei(30), reward24h: wei(5) },
      hedgerVolume24h: "0",
      rewards: [
        { timestamp: 30, reward: wei(12) },
        { timestamp: 10, reward: wei(40) },
      ],
    });
    expect(result).toMatchObject({
      tvl: 25,
      volume24h: 0,
      apy30d: 20,
      rewards24h: 3,
      tokenAmount: 10,
      usdcAmount: 2.5,
      tokenUsdValue: 20,
    });
  });
  it("values a full pending token exit at the balance snapshot rather than a changed live price", () => {
    const result = getPoolStatistics({
      shareFraction: 1,
      priceUsd: 9,
      detail: { tvl: wei(3.04), totalToken: wei(4), totalUsdc: "0" },
      pending: { count: 1, tokenAmount: 4, usdcAmount: 0 },
    });
    expect(result.pendingUsd).toBeCloseTo(3.04);
    expect(result.tvlAfterPending).toBe(0);
    expect(result.tokenAfterPending).toBe(0);
  });
  it("keeps rates while unknown ownership hides scaled amounts", () => {
    const result = getPoolStatistics({
      shareFraction: null,
      listing: { tvl: wei(100), apr30d: 25 },
      detail: { totalToken: wei(3) },
    });
    expect(result).toMatchObject({ tvl: null, tokenAmount: undefined, apy30d: 25 });
  });
  it("counts only pending withdrawals and preserves sub-cent quantities", () => {
    expect(
      sumPoolPendingWithdrawals([
        { type: "withdraw", status: "pending", tokenAmount: "1", usdcAmount: wei(0.001) },
        { type: "deposit", status: "pending", tokenAmount: wei(99) },
        { type: "withdraw", status: "canceled", tokenAmount: wei(99) },
      ]),
    ).toEqual({ count: 1, tokenAmount: 1e-18, usdcAmount: 0.001 });
  });
});

describe("portfolio parity", () => {
  it("prices deposits before totaling and retains rewards from withdrawn positions", () => {
    const result = getPoolPortfolioTotals(
      [
        {
          balanceUsd: 20,
          depositedTokens: 10,
          priceUsd: 2,
          apr: 10,
          aprWeightUsdc: 5,
          claimableReward: 0.001,
          canClaim: true,
        },
        { balanceUsd: 10, depositedTokens: 10000, apr: 20, aprWeightUsdc: 5, claimableReward: 0.001, canClaim: true },
      ],
      [
        { claimed: 5, claimable: 0.001 },
        { claimed: 10, claimable: 0, optimisticClaimed: 12 },
      ],
      [0.001, 0.001],
    );
    expect(result).toMatchObject({
      totalDeposited: 20,
      totalBalance: 30,
      avgApr: 15,
      roi: 50,
      totalLifetimeRewards: 17.001,
      topIndex: 0,
      topPoolPct: 50,
    });
  });
  it("never adds unfunded catalog rows and keeps case-sensitive Solana identities separate", () => {
    const rows = assemblePoolPortfolio(
      [],
      [{ contractAddress: "unfunded", chainId: 0, marketStatus: ListingMarketStatus.REJECTED }],
      [
        { contractAddress: "Mint", chainId: 0, amount: 1n, decimals: 6, status: "pending" },
        { contractAddress: "mint", chainId: 0, amount: 2n, decimals: 18, status: "success" },
      ],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
      history: { pending: 1000000000000n },
    });
    expect(rows[1]).toMatchObject({ marketStatus: ListingMarketStatus.LISTED, history: { success: 2n } });
  });
});
