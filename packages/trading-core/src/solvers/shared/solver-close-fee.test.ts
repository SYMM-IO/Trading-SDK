import { describe, expect, it } from "vitest";
import {
  calculateSolverCloseFee,
  getSolverCloseFeeRate,
  toThresholdSeconds,
  type SolverCloseFeeRates,
} from "./solver-close-fee";

/** Staging numbers from the task: 0.0024 → 0.0006 over 30s → 180s. */
const STAGING: SolverCloseFeeRates = {
  hedgerFeeClose: "0.0006",
  hedgerFeeCloseEarlyRate: "0.0024",
  hedgerFeeCloseEarlyThreshold: 30,
  hedgerFeeCloseStandardThreshold: 180,
};

describe("getSolverCloseFeeRate", () => {
  it("charges the early rate at or before the early threshold", () => {
    expect(getSolverCloseFeeRate(STAGING, 0)).toBe("0.0024");
    expect(getSolverCloseFeeRate(STAGING, 15)).toBe("0.0024");
    expect(getSolverCloseFeeRate(STAGING, 30)).toBe("0.0024");
  });

  it("charges the standard rate at or after the standard threshold", () => {
    expect(getSolverCloseFeeRate(STAGING, 180)).toBe("0.0006");
    expect(getSolverCloseFeeRate(STAGING, 600)).toBe("0.0006");
  });

  it("interpolates linearly between the thresholds", () => {
    // Midpoint 105s → halfway between 0.0024 and 0.0006 = 0.0015.
    expect(getSolverCloseFeeRate(STAGING, 105)).toBe("0.0015");
    // Quarter point 67.5s → 0.0024 - 0.25 * 0.0018 = 0.00195.
    expect(getSolverCloseFeeRate(STAGING, 67.5)).toBe("0.00195");
  });

  it("clamps a negative holding time to the peak (freshly opened)", () => {
    expect(getSolverCloseFeeRate(STAGING, -10)).toBe("0.0024");
  });

  it("steps straight to the floor when thresholds are non-increasing", () => {
    const stepped: SolverCloseFeeRates = { ...STAGING, hedgerFeeCloseStandardThreshold: 30 };
    expect(getSolverCloseFeeRate(stepped, 30)).toBe("0.0024");
    expect(getSolverCloseFeeRate(stepped, 31)).toBe("0.0006");
  });

  it("returns the flat close rate when there is no decay", () => {
    const flat: SolverCloseFeeRates = {
      hedgerFeeClose: "0.0006",
      hedgerFeeCloseEarlyRate: "0.0006",
      hedgerFeeCloseEarlyThreshold: 0,
      hedgerFeeCloseStandardThreshold: 0,
    };
    expect(getSolverCloseFeeRate(flat, 0)).toBe("0.0006");
    expect(getSolverCloseFeeRate(flat, 1000)).toBe("0.0006");
  });

  it("falls back to the close rate when the early rate is unusable (negative)", () => {
    const bad: SolverCloseFeeRates = { ...STAGING, hedgerFeeCloseEarlyRate: "-0.001" };
    expect(getSolverCloseFeeRate(bad, 0)).toBe("0.0006");
  });
});

describe("calculateSolverCloseFee", () => {
  it("applies the time-based rate to the notional", () => {
    expect(calculateSolverCloseFee(STAGING, { notional: "1000", holdingSeconds: 0 })).toBe("2.4");
    expect(calculateSolverCloseFee(STAGING, { notional: "1000", holdingSeconds: 180 })).toBe("0.6");
    expect(calculateSolverCloseFee(STAGING, { notional: "1000", holdingSeconds: 105 })).toBe("1.5");
  });

  it('returns "0" for a negative notional', () => {
    expect(calculateSolverCloseFee(STAGING, { notional: "-100", holdingSeconds: 0 })).toBe("0");
  });
});

describe("toThresholdSeconds", () => {
  it("coerces wire strings to whole-second numbers", () => {
    expect(toThresholdSeconds("30")).toBe(30);
    expect(toThresholdSeconds(180)).toBe(180);
  });

  it("defaults absent or non-finite/negative values to 0", () => {
    expect(toThresholdSeconds(undefined)).toBe(0);
    expect(toThresholdSeconds("oops")).toBe(0);
    expect(toThresholdSeconds(-5)).toBe(0);
  });
});
