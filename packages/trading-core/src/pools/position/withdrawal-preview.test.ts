import { describe, expect, it } from "vitest";
import { calculatePoolPosition } from "./calculate-pool-position";
const ONE = 10n ** 18n;
const input = {
  tokenContractAddress: "Mint",
  depositChain: 0,
  detail: null,
  deposits: null,
  profit: {
    userLpAmount: 4n * ONE,
    pendingWithdrawLpAmount: ONE,
    availableLpAmount: 3n * ONE,
    userBalanceInTokens: 8n * ONE,
    userBalanceInUsdc: 16n * ONE,
    claimableReward: 0n,
    claimedReward: 0n,
    userDepositedTokenAmount: 8n * ONE,
  },
};
describe("position withdrawal preview", () => {
  it("returns exact available LP and legs through the grouped projection", () => {
    expect(calculatePoolPosition({ ...input, withdrawalPercent: 50, priceUsd: 2 })).toMatchObject({
      pendingRatio: 0.25,
      withdrawalLpAmount: (15n * ONE) / 10n,
      withdrawalTokenAmount: 3n * ONE,
      withdrawalUsdcAmount: 6n * ONE,
      withdrawalValueUsd: 12n * ONE,
    });
    expect(calculatePoolPosition({ ...input, withdrawalPercent: 50 }).withdrawalValueUsd).toBe(6n * ONE);
  });
  it("floors integer percentages and retains all LP dust at 100 percent", () => {
    const profit = { ...input.profit, userLpAmount: 4n * ONE + 7n };
    expect(calculatePoolPosition({ ...input, profit, withdrawalPercent: 100 }).withdrawalLpAmount).toBe(3n * ONE + 7n);
    expect(calculatePoolPosition({ ...input, profit, withdrawalPercent: 25 }).withdrawalLpAmount).toBe(
      (3n * ONE + 7n) / 4n,
    );
  });
  it("distinguishes an absent selection or profit from zero and clamps pending consistently", () => {
    expect(calculatePoolPosition(input).withdrawalLpAmount).toBeNull();
    expect(calculatePoolPosition({ ...input, profit: null, withdrawalPercent: 100 })).toMatchObject({
      pendingRatio: null,
      withdrawalLpAmount: null,
      withdrawalValueUsd: null,
    });
    expect(calculatePoolPosition({ ...input, withdrawalPercent: 0 })).toMatchObject({
      withdrawalLpAmount: 0n,
      withdrawalValueUsd: 0n,
    });
    expect(
      calculatePoolPosition({
        ...input,
        profit: { ...input.profit, pendingWithdrawLpAmount: 5n * ONE },
        withdrawalPercent: 100,
      }),
    ).toMatchObject({ pendingRatio: 1, withdrawalLpAmount: 0n });
    expect(
      calculatePoolPosition({
        ...input,
        profit: { ...input.profit, userLpAmount: 0n, pendingWithdrawLpAmount: 0n },
        withdrawalPercent: 100,
      }),
    ).toMatchObject({ pendingRatio: 0, withdrawalLpAmount: 0n, withdrawalTokenAmount: 0n });
  });
  it.each([-1, 101, 0.5, NaN, Infinity])("rejects invalid percentage %s", (withdrawalPercent) => {
    expect(() => calculatePoolPosition({ ...input, withdrawalPercent })).toThrow(RangeError);
  });
});
