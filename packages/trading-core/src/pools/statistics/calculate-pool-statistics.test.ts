import { describe, expect, expectTypeOf, it } from "vitest";
import type { MarketInfo } from "../../solvers/market-info/types";
import type { ListingMarket, ListingMarketDetail, PoolTransaction, UserPoolProfit } from "../types";
import type { CalculatePoolStatisticsParameters } from "./calculate-pool-statistics";
import { calculatePoolStatistics } from "./calculate-pool-statistics";
const wei = 10n ** 18n;
function detail(): ListingMarketDetail {
  return {
    symbolId: 1,
    tvl: (304n * wei) / 100n,
    reportedTotalTokenInPool: 4n * wei,
    reportedTotalUsdcInPool: 0n,
    totalUsdcInPool: 4n * wei,
    reportedMaintenanceFees: 0n,
    apy: { d30: (125n * wei) / 10n, lifetime: 0n },
    rewards: { h24: 9n * wei, d30: 10n * wei, lifetime: 12n * wei },
  } as ListingMarketDetail;
}
const sources = { detail: null, pending: null, rewards: null, notionalCap: null, marketInfo: null };
describe("composed statistics", () => {
  it("accepts source reads unchanged and preserves independent source precedence", () => {
    expectTypeOf<ListingMarketDetail | null>().toExtend<CalculatePoolStatisticsParameters["detail"]>();
    expectTypeOf<readonly PoolTransaction[] | null>().toExtend<CalculatePoolStatisticsParameters["pending"]>();
    const result = calculatePoolStatistics({
      ...sources,
      scope: "user",
      detail: {
        ...detail(),
        tvl: 90n * wei,
        reportedTotalTokenInPool: 40n * wei,
        reportedTotalUsdcInPool: 10n * wei,
        totalUsdcInPool: 10n * wei,
      },
      listing: { tvl: 100n * wei, vol24h: 900n * wei, aprByWindow: { d30: 20n * wei } } as ListingMarket,
      profit: { userBalanceInUsdc: (25n * wei) / 10n } as UserPoolProfit,
      marketInfo: { kind: "enigma", markets: [{ symbolId: 1, tradingVolume: 0, lifetimeValue: 1000 }] } as MarketInfo,
      rewards: [
        { timestamp: 30, reward: 12n * wei },
        { timestamp: 10, reward: 40n * wei },
      ],
    });
    expect(result).toMatchObject({
      tvl: 25,
      volume24h: 0,
      apy30d: 20,
      rewards24h: 3,
      tokenAmount: 10n * wei,
      usdcAmount: (25n * wei) / 10n,
      tokenUsdValue: 20,
    });
  });
  it("preserves unknown rather than defaulting to zero", () => {
    expect(calculatePoolStatistics(sources)).toMatchObject({
      tvl: null,
      tokenAmount: null,
      pendingUsd: null,
      apy30d: null,
      tokenPercent: null,
    });
  });
  it("prices a full pending exit from its balance snapshot, not a changed live price", () => {
    const result = calculatePoolStatistics({
      ...sources,
      detail: detail(),
      priceUsd: 9,
      pending: [{ type: "withdraw", status: "pending", tokenAmount: 4n * wei, usdcAmount: 0n } as PoolTransaction],
    });
    expect(result.pendingUsd).toBeCloseTo(3.04);
    expect(result.tvlAfterPending).toBe(0);
    expect(result.tokenAfterPending).toBe(0n);
  });
  it("uses the latest reward timestamp and never scales percentages", () => {
    const result = calculatePoolStatistics({
      ...sources,
      detail: detail(),
      scope: "user",
      profit: { userBalanceInUsdc: wei } as UserPoolProfit,
      rewards: [
        { timestamp: 20, reward: 12n * wei },
        { timestamp: 10, reward: 40n * wei },
      ],
    });
    expect(result.rewards24h).toBe(3);
    expect(result.apy30d).toBe(12.5);
    expect(result.tokenAmount).toBe(wei);
    expect(result.pendingUsd).toBeNull();
  });
  it("unknown ownership hides amounts but retains rates", () => {
    expect(calculatePoolStatistics({ ...sources, detail: detail(), scope: "user", profit: null })).toMatchObject({
      tvl: null,
      apy30d: 12.5,
    });
  });
  it("sums only pending withdrawals with exact integer amounts", () => {
    const result = calculatePoolStatistics({
      ...sources,
      detail: detail(),
      pending: [
        { type: "withdraw", status: "pending", tokenAmount: 1n, usdcAmount: 1n },
        { type: "deposit", status: "pending", tokenAmount: 99n, usdcAmount: 99n },
      ] as PoolTransaction[],
    });
    expect(result.pendingToken).toBe(1n);
    expect(result.pendingUsdc).toBe(1n);
    expect(result.pendingCount).toBe(1);
  });
});
