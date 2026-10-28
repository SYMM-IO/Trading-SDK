import { describe, expect, it } from "vitest";
import { calculatePoolStatistics } from "./calculate-pool-statistics";
const wei = 10n ** 18n;
const sources = { detail: null, pending: null, rewards: null, notionalCap: null, marketInfo: null };
describe("statistics snapshot compatibility", () => {
  it("uses explicit ownership without scaling rates or assigning the pool queue to a user", () => {
    expect(
      calculatePoolStatistics({
        ...sources,
        scope: "user",
        shareFraction: 0.032,
        listing: { tvl: 100n * wei, reward24h: 10n * wei, reward30d: 20n * wei, rewardLifetime: 30n * wei },
        apy30dFallback: 12500000000000000000n,
        pendingTotals: { count: 1, tokenAmount: wei, usdcAmount: wei },
      }),
    ).toMatchObject({
      tvl: 3.2,
      rewards24h: 0.32,
      rewards30d: 0.64,
      lifetimeRewards: 0.96,
      apy30d: 12.5,
      pendingUsd: null,
    });
    expect(
      calculatePoolStatistics({ ...sources, scope: "user", shareFraction: null, listing: { tvl: wei } }).tvl,
    ).toBeNull();
  });
  it("preserves zero source precedence and legacy reward fallback", () => {
    const result = calculatePoolStatistics({
      ...sources,
      detail: { legacyLifetimeReward: "12.5", buybackRatio: 0 },
      listing: { symbolId: 1, vol24h: 5n * wei, maxLeverage: 10 },
      buybackRatioFallback: 9,
      marketInfo: { kind: "enigma", markets: [{ symbolId: 1, tradingVolume: 0 }] },
    });
    expect(result).toMatchObject({
      lifetimeRewards: 12.5,
      volume24h: 0,
      buybackRatio: 0,
      maxLeverage: 10,
      openInterest: null,
    });
  });
  it("prices pending with collateral fallback and marks incomplete valuation", () => {
    expect(
      calculatePoolStatistics({ ...sources, pendingTotals: { count: 2, tokenAmount: wei, usdcAmount: 2n * wei } }),
    ).toMatchObject({ pendingUsd: 2, pendingValuationComplete: false, pendingCount: 2 });
  });
});
