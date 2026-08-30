import { describe, expect, it } from "vitest";
import { projectListingMarketConfig } from "./project-listing-market-config";

const ONE = 10n ** 18n;

/** A pool holding 1000 tokens and no USDC, valued at $1000. */
const POOL = {
  poolBuybackRatio: 50,
  poolMaxLeverage: 20,
  priorBuybackRatio: null,
  priorMaxLeverage: null,
  totalTokenInPool: 1000n * ONE,
  tvl: 1000n * ONE,
  totalUsdcInPool: 0n,
} as const;

describe("projectListingMarketConfig", () => {
  it("weights the caller's opinion by their token share when the pool holds no USDC", () => {
    const projection = projectListingMarketConfig({
      ...POOL,
      userTokenAmount: 100n * ONE,
      buybackRatio: 100,
      maxLeverage: 10,
    });

    expect(projection.share).toBeCloseTo(0.1, 6);
    /** 50 + 0.1 * (100 - 50) */
    expect(projection.projectedBuybackRatio).toBeCloseTo(55, 6);
    /** 20 + 0.1 * (10 - 20) */
    expect(projection.projectedMaxLeverage).toBeCloseTo(19, 6);
  });

  it("shifts from the caller's prior opinion, not the pool, once they have one", () => {
    const projection = projectListingMarketConfig({
      ...POOL,
      priorBuybackRatio: 80,
      userTokenAmount: 100n * ONE,
      buybackRatio: 100,
    });

    /** 50 + 0.1 * (100 - 80) */
    expect(projection.projectedBuybackRatio).toBeCloseTo(52, 6);
  });

  it("discounts the share by the USDC portion of TVL, so a tiny pool's swap does not inflate it", () => {
    const projection = projectListingMarketConfig({
      ...POOL,
      /** Half of TVL is USDC, which carries no token-opinion weight. */
      totalUsdcInPool: 500n * ONE,
      userTokenAmount: 100n * ONE,
      buybackRatio: 100,
    });

    expect(projection.share).toBeCloseTo(0.05, 6);
    expect(projection.projectedBuybackRatio).toBeCloseTo(52.5, 6);
  });

  it("clamps the share to 1 when the caller's balance exceeds the pool total", () => {
    const projection = projectListingMarketConfig({
      ...POOL,
      userTokenAmount: 5000n * ONE,
      buybackRatio: 100,
    });

    expect(projection.share).toBe(1);
    expect(projection.projectedBuybackRatio).toBeCloseTo(100, 6);
  });

  it("returns a zero share for an empty pool instead of dividing by zero", () => {
    const projection = projectListingMarketConfig({
      ...POOL,
      totalTokenInPool: 0n,
      tvl: 0n,
      userTokenAmount: 100n * ONE,
      buybackRatio: 100,
    });

    expect(projection.share).toBe(0);
    expect(projection.projectedBuybackRatio).toBe(50);
  });

  it("returns null for a knob with no pool value or no entered value", () => {
    const projection = projectListingMarketConfig({
      ...POOL,
      poolMaxLeverage: null,
      userTokenAmount: 100n * ONE,
      maxLeverage: 10,
    });

    expect(projection.projectedMaxLeverage).toBeNull();
    /** buybackRatio was not entered, so it does not project either. */
    expect(projection.projectedBuybackRatio).toBeNull();
  });

  it("treats a null tvl as an unknown value and zeroes the share", () => {
    const projection = projectListingMarketConfig({
      ...POOL,
      tvl: null,
      userTokenAmount: 100n * ONE,
      buybackRatio: 100,
    });

    expect(projection.share).toBe(0);
  });
});
