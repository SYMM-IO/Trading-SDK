import { describe, expect, it } from "vitest";
import { projectFundingRate } from "./project-funding-rate";

describe("projectFundingRate", () => {
  it("projects linearly by the number of epochs in the window (12h epoch)", () => {
    // 12h epoch → 2 epochs/day → 60 epochs over 30 days.
    expect(projectFundingRate({ ratePerEpoch: -0.0003014, epochDurationSeconds: 43_200, days: 30 })).toBeCloseTo(
      -0.0003014 * 60,
      12,
    );
  });

  it("reproduces the reference 1D (×2) and 1Y (×730) multipliers for a 12h epoch", () => {
    const ratePerEpoch = 0.0001;
    expect(projectFundingRate({ ratePerEpoch, epochDurationSeconds: 43_200, days: 1 })).toBeCloseTo(
      ratePerEpoch * 2,
      12,
    );
    expect(projectFundingRate({ ratePerEpoch, epochDurationSeconds: 43_200, days: 365 })).toBeCloseTo(
      ratePerEpoch * 730,
      12,
    );
  });

  it("returns 0 for a zero-day window", () => {
    expect(projectFundingRate({ ratePerEpoch: 0.0001, epochDurationSeconds: 43_200, days: 0 })).toBe(0);
  });

  it("returns 0 when the epoch length is non-positive", () => {
    expect(projectFundingRate({ ratePerEpoch: 0.0001, epochDurationSeconds: 0, days: 30 })).toBe(0);
  });
});
