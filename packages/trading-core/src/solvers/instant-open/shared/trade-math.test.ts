import { describe, expect, it } from "vitest";
import {
  calculateAvailableInstantOpenMargin,
  calculateExpectedSettlementLoss,
  calculateMargin,
  calculateSolverFees,
  calculateTradeParams,
} from "./trade-math";
import { PositionType } from "./types";

const E18 = 10n ** 18n;

/**
 * Fixture: 1000 collateral, 0.1% open + 0.1% close fee, 10x, 5% slippage.
 * LONG shaves fees only; SHORT also caps at (1 − slippage).
 */
const BASE = {
  balance: 1000n * E18,
  openFee: E18 / 1000n, // 0.1%
  closeFee: E18 / 1000n, // 0.1%
  slippageFractionWei: 5n * 10n ** 16n, // 5%
  leverage: 10,
};

/**
 * Fixture: 1000 USD collateral at mark 100, 10x, 5% slippage.
 * Quantity must come from the raw mark, never the slippage-adjusted bound.
 */
const TRADE = {
  markPrice: "100",
  slippage: 5,
  userInput: "1000",
  inputField: "PRICE" as const,
  leverage: 10,
  pricePrecision: 2,
  quantityPrecision: 3,
  cvaPercent: "2",
  lfPercent: "1",
  partyAmmPercent: "97",
  partyBmmPercent: "0",
};

describe("calculateTradeParams", () => {
  it("sizes quantity at the raw mark price, not the slippage-adjusted bound (LONG)", () => {
    const result = calculateTradeParams({ ...TRADE, positionType: PositionType.LONG });

    // 1000 / 100 = 10 base units, even though the price bound is 105.00
    expect(result?.quantityBasic).toBe("10.000");
    expect(result?.quantity).toBe("100.000");
    expect(result?.requestedOpenPrice).toBe("105.00");
  });

  it("gives LONG and SHORT the same size for the same margin", () => {
    const long = calculateTradeParams({ ...TRADE, positionType: PositionType.LONG });
    const short = calculateTradeParams({ ...TRADE, positionType: PositionType.SHORT });

    expect(short?.quantity).toBe(long?.quantity);
    expect(short?.requestedOpenPrice).toBe("95.00");
  });

  it("does not resize the position when slippage changes", () => {
    const tight = calculateTradeParams({ ...TRADE, slippage: 1, positionType: PositionType.LONG });
    const wide = calculateTradeParams({ ...TRADE, slippage: 20, positionType: PositionType.LONG });

    expect(tight?.quantity).toBe(wide?.quantity);
  });
});

describe("calculateSolverFees", () => {
  it("charges both legs on the leveraged notional", () => {
    expect(calculateSolverFees({ notional: "1000", hedgerFeeOpen: "0.0004", hedgerFeeClose: "0.001" })).toEqual({
      openSolverFee: "0.4",
      closeSolverFee: "1",
    });
  });

  it("treats absent, NaN, or negative rates as zero", () => {
    expect(calculateSolverFees({ notional: "1000", hedgerFeeOpen: undefined, hedgerFeeClose: "-0.1" })).toEqual({
      openSolverFee: "0",
      closeSolverFee: "0",
    });
  });
});

describe("calculateExpectedSettlementLoss", () => {
  const BASE_LOSS = { markPrice: "100", quantity: "50" };

  it("LONG loses when the expected fill lands above mark", () => {
    expect(
      calculateExpectedSettlementLoss({ ...BASE_LOSS, positionType: PositionType.LONG, expectedFillPrice: "101" }),
    ).toBe("50");
  });

  it("SHORT loses when the expected fill lands below mark", () => {
    expect(
      calculateExpectedSettlementLoss({ ...BASE_LOSS, positionType: PositionType.SHORT, expectedFillPrice: "99" }),
    ).toBe("50");
  });

  it("clamps a favorable expected fill to zero", () => {
    expect(
      calculateExpectedSettlementLoss({ ...BASE_LOSS, positionType: PositionType.LONG, expectedFillPrice: "99" }),
    ).toBe("0");
  });

  it("returns zero without an estimate", () => {
    expect(
      calculateExpectedSettlementLoss({ ...BASE_LOSS, positionType: PositionType.LONG, expectedFillPrice: undefined }),
    ).toBe("0");
  });
});

describe("calculateMargin", () => {
  it("applies the short funding buffer to the SHORT margin basis", () => {
    const base = {
      positionType: PositionType.SHORT,
      markPrice: "100",
      quantityBasic: "1",
      cva: "0",
      lf: "0",
      partyAmm: "0",
      cvaPercent: "7",
      lfPercent: "3",
      partyAmmPercent: "90",
      platformFee: "0",
    };

    // locks percents sum to 100% of the (buffered) notional
    expect(calculateMargin(base)).toBe("100");
    expect(calculateMargin({ ...base, shortFundingBufferPercent: 1 })).toBe("101");
  });

  it("adds solver fees and expected settlement loss on top of locks and platform fee", () => {
    const margin = calculateMargin({
      positionType: PositionType.LONG,
      markPrice: "100",
      quantityBasic: "1",
      cva: "1",
      lf: "1",
      partyAmm: "1",
      platformFee: "0.5",
      openSolverFee: "0.1",
      closeSolverFee: "0.2",
      expectedSettlementLoss: "0.3",
    });

    expect(margin).toBe("4.1");
  });
});

describe("calculateAvailableInstantOpenMargin", () => {
  it("LONG shaves fees only, ignores slippage", () => {
    // feeMultiplier = 1 − 10 × (0.001 + 0.001) = 0.98 ; slippage ignored -> 980
    expect(calculateAvailableInstantOpenMargin({ ...BASE, positionType: PositionType.LONG })).toBe(980n * E18);
  });

  it("SHORT also applies the slippage cap", () => {
    // 1000 × (1 − 0.05) × 0.98 = 931
    expect(calculateAvailableInstantOpenMargin({ ...BASE, positionType: PositionType.SHORT })).toBe(931n * E18);
  });

  it("returns 0n when slippage ≥ 100% on SHORT", () => {
    expect(
      calculateAvailableInstantOpenMargin({ ...BASE, slippageFractionWei: E18, positionType: PositionType.SHORT }),
    ).toBe(0n);
  });

  it("returns 0n when leverage × total fee ≥ 100%", () => {
    // 500 × (0.001 + 0.001) = 1.0
    expect(calculateAvailableInstantOpenMargin({ ...BASE, leverage: 500, positionType: PositionType.LONG })).toBe(0n);
  });

  it("returns the full balance with no fees and no slippage (LONG)", () => {
    expect(
      calculateAvailableInstantOpenMargin({
        balance: 1000n * E18,
        openFee: 0n,
        closeFee: 0n,
        slippageFractionWei: 0n,
        leverage: 10,
        positionType: PositionType.LONG,
      }),
    ).toBe(1000n * E18);
  });
});
