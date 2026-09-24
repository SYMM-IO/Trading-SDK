import { describe, expect, it } from "vitest";
import { WEI } from "../shared/utils/wei";
import { calculateMarginRisk, type CalculateMarginRiskInputs } from "./calculate-margin-risk";

/** Build inputs from human units, so the cases read as dollars. */
function makeInputs(overrides: Partial<Record<keyof CalculateMarginRiskInputs, number>> = {}) {
  const base = { allocatedBalance: 1000, lockedCVA: 40, lockedLF: 10, lockedPartyAMM: 100, upnl: 0 };
  const merged = { ...base, ...overrides };
  return {
    allocatedBalance: BigInt(merged.allocatedBalance) * WEI,
    lockedCVA: BigInt(merged.lockedCVA) * WEI,
    lockedLF: BigInt(merged.lockedLF) * WEI,
    lockedPartyAMM: BigInt(merged.lockedPartyAMM) * WEI,
    upnl: BigInt(merged.upnl) * WEI,
  };
}

describe("calculateMarginRisk", () => {
  it("derives every figure from the balance fields on a flat book", () => {
    expect(calculateMarginRisk(makeInputs())).toEqual({
      totalMargin: 1000n * WEI,
      maintenanceMargin: 50n * WEI, // 40 cva + 10 lf
      initialMargin: 150n * WEI, // + 100 partyAmm
      equity: 1000n * WEI,
      remainingToLiquidation: 950n * WEI,
      liquidationBufferPercent: 100n * WEI,
      isLiquidatable: false,
    });
  });

  it("matches the contract's totalForPartyA() for initialMargin", () => {
    const inputs = makeInputs();
    expect(calculateMarginRisk(inputs).initialMargin).toBe(inputs.lockedCVA + inputs.lockedLF + inputs.lockedPartyAMM);
  });

  it("pushes the buffer above 100% on a profitable book, unclamped", () => {
    const metrics = calculateMarginRisk(makeInputs({ upnl: 950 }));
    expect(metrics.equity).toBe(1950n * WEI);
    // 1900 / 950 = 200%
    expect(metrics.liquidationBufferPercent).toBe(200n * WEI);
    expect(metrics.isLiquidatable).toBe(false);
  });

  it("halves the buffer on a loss of half the cushion", () => {
    // remaining 475 / zero-uPnL cushion 950 = 50%
    expect(calculateMarginRisk(makeInputs({ upnl: -475 })).liquidationBufferPercent).toBe(50n * WEI);
  });

  it("is not yet liquidatable when equity exactly equals the maintenance margin", () => {
    /** The contract predicate is a strict `<`, so the boundary is still solvent. */
    const metrics = calculateMarginRisk(makeInputs({ upnl: -950 }));
    expect(metrics.equity).toBe(metrics.maintenanceMargin);
    expect(metrics.remainingToLiquidation).toBe(0n);
    expect(metrics.liquidationBufferPercent).toBe(0n);
    expect(metrics.isLiquidatable).toBe(false);
  });

  it("flips to liquidatable one wei past the boundary", () => {
    const inputs = makeInputs({ upnl: -950 });
    const metrics = calculateMarginRisk({ ...inputs, upnl: inputs.upnl - 1n });
    expect(metrics.remainingToLiquidation).toBe(-1n);
    expect(metrics.isLiquidatable).toBe(true);
    /**
     * One wei of deficit against a 950-unit cushion truncates to `0n` — the
     * percent is a display signal and cannot resolve that, which is exactly why
     * `isLiquidatable` exists rather than a threshold on it.
     */
    expect(metrics.liquidationBufferPercent).toBe(0n);
  });

  it("carries a negative buffer once the deficit is material", () => {
    // remaining −475 / cushion 950 = −50%
    expect(calculateMarginRisk(makeInputs({ upnl: -1425 })).liquidationBufferPercent).toBe(-50n * WEI);
  });

  it("suppresses the buffer when the zero-uPnL cushion is not positive", () => {
    /**
     * The denominator is degenerate, so the ratio is undefined — not `0`.
     * Returning `0` here (as the reference app does) paints a profitable
     * account as maximum risk.
     */
    expect(calculateMarginRisk(makeInputs({ allocatedBalance: 50 })).liquidationBufferPercent).toBeUndefined();
    expect(calculateMarginRisk(makeInputs({ allocatedBalance: 20 })).liquidationBufferPercent).toBeUndefined();
  });

  it("still reports a degenerate-cushion account as solvent while its uPnL carries it", () => {
    const metrics = calculateMarginRisk(makeInputs({ allocatedBalance: 50, upnl: 500 }));
    expect(metrics.liquidationBufferPercent).toBeUndefined();
    expect(metrics.remainingToLiquidation).toBe(500n * WEI);
    expect(metrics.isLiquidatable).toBe(false);
  });

  it("returns all zeros for an empty account", () => {
    expect(
      calculateMarginRisk({
        allocatedBalance: 0n,
        lockedCVA: 0n,
        lockedLF: 0n,
        lockedPartyAMM: 0n,
        upnl: 0n,
      }),
    ).toEqual({
      totalMargin: 0n,
      maintenanceMargin: 0n,
      initialMargin: 0n,
      equity: 0n,
      remainingToLiquidation: 0n,
      liquidationBufferPercent: undefined,
      isLiquidatable: false,
    });
  });

  it("keeps isLiquidatable identical to the on-chain solvency predicate", () => {
    /** `LibAccount.partyAAvailableBalanceForLiquidation` (perps-core v0.8.6). */
    const cases = [
      makeInputs(),
      makeInputs({ upnl: -949 }),
      makeInputs({ upnl: -950 }),
      makeInputs({ upnl: -951 }),
      makeInputs({ upnl: 500 }),
      makeInputs({ allocatedBalance: 0, upnl: -1 }),
      makeInputs({ allocatedBalance: 50, upnl: 500 }),
    ];
    for (const inputs of cases) {
      const availableForLiquidation = inputs.allocatedBalance - (inputs.lockedCVA + inputs.lockedLF) + inputs.upnl;
      expect(calculateMarginRisk(inputs).isLiquidatable).toBe(availableForLiquidation < 0n);
    }
  });

  it("is pure — repeatable and non-mutating", () => {
    const inputs = makeInputs({ upnl: -100 });
    const snapshot = { ...inputs };
    expect(calculateMarginRisk(inputs)).toEqual(calculateMarginRisk(inputs));
    expect(inputs).toEqual(snapshot);
  });
});
