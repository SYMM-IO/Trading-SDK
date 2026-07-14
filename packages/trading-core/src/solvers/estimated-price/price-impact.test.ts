import { describe, expect, it } from "vitest";
import { calculatePriceImpact } from "./price-impact";

describe("calculatePriceImpact", () => {
  it("computes the signed percent difference vs the reference", () => {
    expect(calculatePriceImpact({ estimatedPrice: "101", referencePrice: "100" })).toBeCloseTo(1);
    expect(calculatePriceImpact({ estimatedPrice: "99", referencePrice: "100" })).toBeCloseTo(-1);
    expect(calculatePriceImpact({ estimatedPrice: "100", referencePrice: "100" })).toBe(0);
  });

  it("returns 0 for a zero or non-finite reference / estimate", () => {
    expect(calculatePriceImpact({ estimatedPrice: "1", referencePrice: "0" })).toBe(0);
    expect(calculatePriceImpact({ estimatedPrice: "x", referencePrice: "100" })).toBe(0);
    expect(calculatePriceImpact({ estimatedPrice: "1", referencePrice: "y" })).toBe(0);
  });
});
