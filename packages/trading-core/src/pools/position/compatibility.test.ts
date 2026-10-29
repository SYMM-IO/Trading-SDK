import { describe, expect, it } from "vitest";
import { calculatePoolPosition } from "./calculate-pool-position";

const wei = 10n ** 18n;
const sources = { detail: null, profit: null, deposits: null };
describe("scoped position snapshots", () => {
  it("prefers backend ownership including zero, then same-profit USDC, then detail", () => {
    const input = {
      ...sources,
      profit: { userBalanceInUsdc: 25n * wei, totalUsdcInPool: 100n * wei },
      detail: { totalUsdcInPool: 200n * wei },
    };
    expect(calculatePoolPosition({ ...input, userSharePercentage: 3.2 }).shareFraction).toBe(0.032);
    expect(calculatePoolPosition({ ...input, userSharePercentage: 0 }).shareFraction).toBe(0);
    expect(calculatePoolPosition(input).shareFraction).toBe(0.25);
    expect(calculatePoolPosition({ ...input, profit: { userBalanceInUsdc: 25n * wei } }).shareFraction).toBe(0.125);
    expect(calculatePoolPosition({ ...sources, profit: {} }).shareFraction).toBeNull();
  });
  it("preserves a complete history without inventing a profit or pool identity", () => {
    const history = { pending: wei, transferred: 2n * wei, success: 3n * wei, rejected: 5n * wei, refund: 4n * wei };
    expect(calculatePoolPosition({ ...sources, depositHistory: history, priceUsd: 2 })).toMatchObject({
      tokenContractAddress: null,
      depositChain: null,
      depositHistory: history,
      depositedToken: 5n * wei,
      currentDepositToken: 6n * wei,
      uncreditedDepositToken: 2n * wei,
      refundableToken: 6n * wei,
      currentDepositUsd: 12,
      refundableValueUsd: 12,
      balanceUsd: null,
      totalLp: null,
    });
    expect(
      calculatePoolPosition({ ...sources, depositHistory: history, depositsComplete: false }).depositHistory,
    ).toBeNull();
    expect(calculatePoolPosition({ ...sources, depositHistory: history }).currentDepositUsd).toBeNull();
  });
  it("does not turn missing ledger fields into an available withdrawal", () => {
    const row = calculatePoolPosition({
      ...sources,
      profit: { userBalanceInTokens: wei, userBalanceInUsdc: 2n * wei },
      withdrawalPercent: 100,
    });
    expect(row.balanceUsd).toBe(2);
    expect(row.withdrawalLpAmount).toBeNull();
    expect(row.availableRatio).toBeNull();
    expect(row.pendingValueUsd).toBeNull();
    expect(row.valuationComplete).toBe(false);
    expect(() => calculatePoolPosition({ ...sources, depositChain: 0 })).toThrow(/both/);
  });
});
