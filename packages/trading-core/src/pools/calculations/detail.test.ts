import { describe, expect, it } from "vitest";
import { getPoolBalanceBreakdown } from "./balance";
import {
  getPoolDepositPreview,
  getPoolHistoryAmounts,
  getPoolPendingQuoteMetrics,
  getPoolTradeHistoryMetrics,
  getPoolWithdrawalPreview,
} from "./detail";

const ONE = 10n ** 18n;
describe("pool detail calculations", () => {
  it("sizes integer percentages from available LP without losing dust", () => {
    const balance = {
      userLpAmount: 10n * ONE + 7n,
      pendingWithdrawLpAmount: ONE,
      userBalanceInTokens: 100n * ONE,
      userBalanceInUsdc: 20n * ONE,
    };
    expect(getPoolWithdrawalPreview({ balance, percent: 100, tokenPriceUsd: 2 }).lpAmount).toBe(9n * ONE + 7n);
    expect(getPoolWithdrawalPreview({ balance, percent: 25 }).lpAmount).toBe((9n * ONE + 7n) / 4n);
    expect(getPoolWithdrawalPreview({ balance: null, percent: 100 }).lpAmount).toBe(0n);
    expect(getPoolBalanceBreakdown(balance).pendingRatio).toBeCloseTo(0.1);
    expect(() => getPoolWithdrawalPreview({ balance, percent: 0.5 })).toThrow();
  });
  it("values available legs and preserves a missing deposit baseline or price", () => {
    const balance = {
      userLpAmount: 4n * ONE,
      pendingWithdrawLpAmount: ONE,
      userBalanceInTokens: 8n * ONE,
      userBalanceInUsdc: 16n * ONE,
    };
    expect(getPoolWithdrawalPreview({ balance, percent: 50, tokenPriceUsd: 2 })).toEqual({
      lpAmount: (15n * ONE) / 10n,
      tokenAmount: 3n * ONE,
      usdcAmount: 6n * ONE,
      valueUsd: 12n * ONE,
    });
    expect(getPoolWithdrawalPreview({ balance, percent: 50 }).valueUsd).toBe(6n * ONE);
    expect(
      getPoolDepositPreview({ minimumUsd: 10, tokenPriceUsd: 2, baselineTokens: 2n * ONE, currentTokens: 3n * ONE }),
    ).toEqual({ minimumTokens: 5, addedTokens: ONE });
    expect(getPoolDepositPreview({ minimumUsd: 10, currentTokens: ONE })).toEqual({
      minimumTokens: undefined,
      addedTokens: undefined,
    });
    expect(getPoolDepositPreview({ baselineTokens: ONE, currentTokens: 0n }).addedTokens).toBe(0n);
  });
  it("preserves explicit zero requested prices and absent-field fallback", () => {
    expect(getPoolPendingQuoteMetrics({ quantity: 2n * ONE, requestedOpenPrice: "0", openedPrice: 10n * ONE })).toEqual(
      { quantity: 2n * ONE, price: 0n, notional: 0n },
    );
    expect(
      getPoolPendingQuoteMetrics({ quantity: 2n * ONE, requestedOpenPrice: "", openedPrice: 10n * ONE }).notional,
    ).toBe(20n * ONE);
  });
  it("uses immutable partial-close quantities and the full opening fee basis", () => {
    const quote = {
      quantity: 2n * ONE,
      closedAmount: ONE,
      openedPrice: 100n * ONE,
      initialOpenedPrice: 100n * ONE,
      averageClosedPrice: 120n * ONE,
      tradingFee: ONE / 1000n,
      closeFee: ONE / 500n,
      positionType: "0",
    };
    expect(getPoolTradeHistoryMetrics(quote)).toEqual({
      quantity: ONE,
      closePrice: 120n * ONE,
      tradeValue: 120n * ONE,
      platformFee: (44n * ONE) / 100n,
      realizedPnl: 20n * ONE,
    });
    expect(
      getPoolTradeHistoryMetrics({ ...quote, closedAmount: ONE / 2n, averageClosedPrice: 90n * ONE }).realizedPnl,
    ).toBe(-5n * ONE);
    expect(getPoolTradeHistoryMetrics({ ...quote, closedAmount: "0" }).quantity).toBe(0n);
    expect(
      getPoolTradeHistoryMetrics({ ...quote, openedPrice: 100n * ONE, averageClosedPrice: 100n * ONE + 1n })
        .realizedPnl,
    ).toBe(1n);
    expect(quote.closedAmount).toBe(ONE);
  });
  it("sums selected amounts exactly in caller order, including negative values", () => {
    expect(getPoolHistoryAmounts([ONE, 1n, -ONE])).toEqual({ total: 1n, cumulative: [ONE, ONE + 1n, 1n] });
    expect(getPoolHistoryAmounts([])).toEqual({ total: 0n, cumulative: [] });
  });
});
