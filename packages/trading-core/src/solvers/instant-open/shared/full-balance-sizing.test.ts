import { toDecimal } from "@symmio/utils/decimal";
import { describe, expect, it } from "vitest";
import { computeInstantOpenCosts, sizeFullBalanceInstantOpen } from "./full-balance-sizing";
import type { CalculateTradeParamsParameters } from "./trade-math";
import { PositionType } from "./types";

/** Locks percents summing to 100% so `probe margin ≈ sizing input` when no fees exist. */
const BASE_INPUT: CalculateTradeParamsParameters = {
  markPrice: "100",
  slippage: 0,
  positionType: PositionType.LONG,
  userInput: "0",
  inputField: "PRICE",
  leverage: 1,
  pricePrecision: 2,
  quantityPrecision: 3,
  cvaPercent: "7",
  lfPercent: "3",
  partyAmmPercent: "90",
  partyBmmPercent: "0",
};

const ZERO_FEES = { openFee: 0n, closeFee: 0n };

function size(overrides: {
  balance?: string;
  calculationInput?: Partial<CalculateTradeParamsParameters>;
  expectedFillPrice?: string;
  constraints?: Parameters<typeof sizeFullBalanceInstantOpen>[0]["constraints"];
}) {
  return sizeFullBalanceInstantOpen({
    balance: overrides.balance ?? "100",
    calculationInput: { ...BASE_INPUT, ...overrides.calculationInput },
    expectedFillPrice: overrides.expectedFillPrice,
    feeRates: ZERO_FEES,
    constraints: overrides.constraints ?? {},
  });
}

describe("sizeFullBalanceInstantOpen", () => {
  it("shaves only the safety epsilon when there are no fees or settlement", () => {
    const { trade, costs } = size({});

    expect(trade.quantity).toBe("0.999");
    expect(toDecimal(costs.marginAmount).lte("100")).toBe(true);
  });

  it("rescales by the exact linear factor when settlement scales with leverage", () => {
    // Probe: locks 100 (percents sum 100, requested = mark at slippage 0 …
    // with slippage 4 the requested price is 104 → locks 104) + settlement
    // (102 − 100) × 10 = 20 → probe margin 124 → factor 100/124 × 0.999.
    const { trade, costs } = size({
      calculationInput: { leverage: 10, slippage: 4 },
      expectedFillPrice: "102",
    });

    expect(trade.quantity).toBe("8.05");
    expect(toDecimal(costs.marginAmount).lte("100")).toBe(true);
  });

  it("steps the quantity down until the costs fit the balance on a coarse quantity grid", () => {
    // quantityPrecision 0: the probe floors 1.99 units to 1, understating the
    // margin-per-dollar, so the naive factor rescales UP to 3 units whose locks
    // (300) exceed the 199 balance. The invariant loop must walk it back down.
    const { trade, costs } = size({
      balance: "199",
      calculationInput: { quantityPrecision: 0 },
    });

    expect(trade.quantity).toBe("1");
    expect(toDecimal(costs.marginAmount).lte("199")).toBe(true);
  });

  it("provisions settlement at the slippage bound when no estimate exists", () => {
    // No estimate: the settlement leg must budget the worst fill the signed
    // bound admits (requested 104 vs mark 100 → 4 × quantity), never zero.
    const withEstimate = size({ calculationInput: { leverage: 10, slippage: 4 }, expectedFillPrice: "102" });
    const withoutEstimate = size({ calculationInput: { leverage: 10, slippage: 4 } });

    expect(toDecimal(withoutEstimate.costs.expectedSettlementLoss).gt(0)).toBe(true);
    expect(toDecimal(withoutEstimate.trade.quantity).lt(withEstimate.trade.quantity)).toBe(true);
    expect(toDecimal(withoutEstimate.costs.marginAmount).lte("100")).toBe(true);
  });

  it("snaps the sized quantity down to the market's lot grid", () => {
    const { trade, costs } = size({
      calculationInput: { leverage: 10 },
      constraints: { lotSize: "0.2" },
    });

    // Unsnapped sizing would yield 9.99; the lot grid floors it to 9.8.
    expect(trade.quantity).toBe("9.8");
    expect(toDecimal(trade.quantity).mod("0.2").isZero()).toBe(true);
    expect(toDecimal(costs.marginAmount).lte("100")).toBe(true);
  });

  it("keeps the SHORT funding buffer inside the sized margin", () => {
    // SHORT margin basis is mark × 1.01, so the factor must shrink past the
    // plain locks: 100/101 × 0.999 → 0.989 units.
    const { trade, costs } = size({ calculationInput: { positionType: PositionType.SHORT } });

    expect(trade.quantity).toBe("0.989");
    expect(toDecimal(costs.marginAmount).lte("100")).toBe(true);
  });

  it("upsizes past the probe under the slippage-bound model when locks percents sum under 100", () => {
    // Locks 50% → estimate-model factor ≈ 1.85 (> 1), so the probe-size
    // estimate no longer bounds the fill. Bound model: probe margin = locks
    // 52 + settlement 4×1 = 56 → factor 100/56 × 0.999 ≈ 1.784 → 1.783 units
    // provisioned at the bound (104), not the estimate (102).
    const { trade, costs } = size({
      calculationInput: { slippage: 4, cvaPercent: "25", lfPercent: "25", partyAmmPercent: "0" },
      expectedFillPrice: "102",
    });

    expect(trade.quantity).toBe("1.783");
    // Settlement at the bound: (104 − 100) × 1.783.
    expect(costs.expectedSettlementLoss).toBe("7.132");
    expect(toDecimal(costs.marginAmount).lte("100")).toBe(true);
  });

  it("upsizes without an estimate under the bound model alone", () => {
    // No estimate, slippage 0 → bound = mark → settlement 0; locks 50% →
    // factor 1.998 → quantity 1.998, margin 99.9 ≤ 100.
    const { trade, costs } = size({
      calculationInput: { cvaPercent: "25", lfPercent: "25", partyAmmPercent: "0" },
    });

    expect(trade.quantity).toBe("1.998");
    expect(toDecimal(costs.marginAmount).lte("100")).toBe(true);
  });

  it("clamps to the probe size when only the optimistic estimate model upsizes", () => {
    // Estimate-model factor barely above 1, bound-model factor below 1: the
    // honest answer is the probe size itself, where the estimate is valid.
    // Locks 90% at the 8%-slippage bound 108 = 97.2; + estimate settlement 1
    // → 98.2 → est. factor ≈ 1.017 > 1; + bound settlement 8 → 105.2 → bound
    // factor ≈ 0.95 < 1 → clamp to the (1 − ε) probe size.
    const { trade, costs } = size({
      calculationInput: { slippage: 8, cvaPercent: "45", lfPercent: "45", partyAmmPercent: "0" },
      expectedFillPrice: "101",
    });

    expect(trade.quantity).toBe("0.999");
    expect(toDecimal(costs.marginAmount).lte("100")).toBe(true);
  });

  it("throws QUOTE_CONSTRAINT_VIOLATED when the sized quantity misses a published floor", () => {
    expect(() =>
      size({
        calculationInput: { leverage: 10 },
        constraints: { minNotionalValue: "2000" },
      }),
    ).toThrow(/QUOTE_CONSTRAINT_VIOLATED|NOTIONAL_TOO_LOW/);
  });

  it("throws INVALID_TRADE_PARAMETERS instead of dividing by a zero probe margin", () => {
    expect(() =>
      size({
        calculationInput: { cvaPercent: "0", lfPercent: "0", partyAmmPercent: "0" },
      }),
    ).toThrow(/INVALID_TRADE_PARAMETERS|probe margin is zero/);
  });
});

describe("computeInstantOpenCosts", () => {
  it("prices majors with platform legs only — no solver fees, no SHORT buffer", () => {
    const trade = {
      requestedOpenPrice: "100",
      quantityBasic: "1",
      quantity: "1",
      notionalBasic: "100",
      notional: "100",
      cva: "7",
      lf: "3",
      partyAmm: "90",
      partyBmm: "0",
    };

    const costs = computeInstantOpenCosts({
      trade,
      positionType: PositionType.SHORT,
      markPrice: "100",
      expectedFillPrice: undefined,
      feeRates: ZERO_FEES,
      isLowcap: false,
      cvaPercent: "7",
      lfPercent: "3",
      partyAmmPercent: "90",
    });

    expect(costs.openSolverFee).toBe("0");
    expect(costs.closeSolverFee).toBe("0");
    // Unbuffered SHORT basis: locks recomputed at raw mark → exactly 100.
    expect(costs.marginAmount).toBe("100");
  });

  it("adds the solver fee legs and the settlement provision on lowcap", () => {
    const trade = {
      requestedOpenPrice: "100",
      quantityBasic: "1",
      quantity: "2",
      notionalBasic: "100",
      notional: "200",
      cva: "7",
      lf: "3",
      partyAmm: "90",
      partyBmm: "0",
    };

    const costs = computeInstantOpenCosts({
      trade,
      positionType: PositionType.LONG,
      markPrice: "100",
      expectedFillPrice: "101",
      feeRates: ZERO_FEES,
      isLowcap: true,
      hedgerFeeOpen: "0.001",
      hedgerFeeClose: "0.002",
      cvaPercent: "7",
      lfPercent: "3",
      partyAmmPercent: "90",
    });

    // open 0.001 × 200 = 0.2; close 0.002 × 200 = 0.4; settlement (101−100) × 2 = 2.
    expect(costs.openSolverFee).toBe("0.2");
    expect(costs.closeSolverFee).toBe("0.4");
    expect(costs.expectedSettlementLoss).toBe("2");
    // locks 100 + 0.2 + 0.4 + 2 = 102.6.
    expect(costs.marginAmount).toBe("102.6");
  });
});
