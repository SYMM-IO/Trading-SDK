import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { parseUnits } from "./parse-units";

describe("parseUnits", () => {
  it("converts ether to wei (18 decimals)", () => {
    expect(parseUnits("1", 18).toFixed(0)).toBe("1000000000000000000");
  });

  it("converts USDC display to base units (6 decimals)", () => {
    expect(parseUnits("1.23", 6).toFixed(0)).toBe("1230000");
  });

  it("defaults decimals to 18 when omitted", () => {
    expect(parseUnits("1").toFixed(0)).toBe("1000000000000000000");
  });

  it("supports 0 decimals (no scaling)", () => {
    expect(parseUnits("42", 0).toFixed(0)).toBe("42");
  });

  it("accepts numeric input", () => {
    expect(parseUnits(1.5, 6).toFixed(0)).toBe("1500000");
  });

  it("accepts Decimal input", () => {
    expect(parseUnits(new Decimal("0.000001"), 18).toFixed(0)).toBe("1000000000000");
  });

  it("returns 0 for empty string", () => {
    expect(parseUnits("", 18).toFixed(0)).toBe("0");
  });

  it("handles negative values", () => {
    expect(parseUnits("-1.5", 6).toFixed(0)).toBe("-1500000");
  });

  it("preserves precision on small fractions", () => {
    expect(parseUnits("0.000000000000000001", 18).toFixed(0)).toBe("1");
  });

  it("returns a Decimal instance", () => {
    expect(parseUnits("1", 18)).toBeInstanceOf(Decimal);
  });
});
