import { describe, expect, it } from "vitest";
import { getPoolBalanceBreakdown, getPoolBalanceUsd, selectPoolShareFraction } from "./balance";
import { parsePoolPercent, selectPoolPriceUsd } from "./metrics";

describe("pool balance characterization", () => {
  it("keeps sub-micro balances scaled and separates available and pending LP", () => {
    const profit = {
      userLpAmount: 100n,
      pendingWithdrawLpAmount: 40n,
      userBalanceInTokens: 3_000_000_000_000_000_000n,
      userBalanceInUsdc: 536_000_000_000n,
    };
    expect(getPoolBalanceBreakdown(profit)).toEqual({
      totalLpRaw: 100n,
      availableLpRaw: 60n,
      availableRatio: 0.6,
      totalToken: 3,
      totalUsdc: 0.000000536,
      availableToken: 1.8 - Number.EPSILON,
      availableUsdc: 0.000000536 * 0.6,
      pendingToken: 3 * 0.4,
      pendingUsdc: 0.000000536 * 0.4,
      hasPending: true,
    });
    expect(getPoolBalanceUsd(profit, 2)).toBe(6.000000536);
    expect(getPoolBalanceUsd(profit, undefined)).toBe(0.000000536);
    expect(getPoolBalanceUsd(undefined, 2)).toBeNull();
  });
  it("floors available LP at zero without erasing a pending amount", () => {
    const value = getPoolBalanceBreakdown({
      userLpAmount: 1n,
      pendingWithdrawLpAmount: 2n,
      userBalanceInTokens: 0n,
      userBalanceInUsdc: 0n,
    });
    expect(value.availableLpRaw).toBe(0n);
    expect(value.hasPending).toBe(true);
  });
  it("distinguishes unknown ownership from zero and caps ledger percentages", () => {
    expect(selectPoolShareFraction(undefined)).toBeNull();
    expect(selectPoolShareFraction(0, 1, 2)).toBe(0);
    expect(selectPoolShareFraction(undefined, 1, 4)).toBe(0.25);
    expect(selectPoolShareFraction(120)).toBe(1);
  });
  it("preserves price precedence and plain-percent fields", () => {
    expect(selectPoolPriceUsd({ markPriceUsd: 3, listingPriceUsd: "2000000000000000000", dexPriceUsd: "1" })).toBe(3);
    expect(selectPoolPriceUsd({ markPriceUsd: 0, listingPriceUsd: "2000000000000000000", dexPriceUsd: "1" })).toBe(2);
    expect(selectPoolPriceUsd({ dexPriceUsd: "1" })).toBe(1);
    expect(selectPoolPriceUsd({})).toBeUndefined();
    expect(parsePoolPercent("3.2")).toBe(3.2);
    expect(parsePoolPercent("3200000000000000000")).toBe(3.2);
  });
});
