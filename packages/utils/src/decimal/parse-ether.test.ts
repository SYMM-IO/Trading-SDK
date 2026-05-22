import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { parseEther } from "./parse-ether";
import { parseUnits } from "./parse-units";

describe("parseEther", () => {
  it("converts whole ether to wei", () => {
    expect(parseEther("2").toFixed(0)).toBe("2000000000000000000");
  });

  it("converts fractional ether to wei", () => {
    expect(parseEther("0.002").toFixed(0)).toBe("2000000000000000");
  });

  it("matches parseUnits(value, 18)", () => {
    expect(parseEther("3.14").toFixed(0)).toBe(parseUnits("3.14", 18).toFixed(0));
  });

  it("accepts numeric input", () => {
    expect(parseEther(1).toFixed(0)).toBe("1000000000000000000");
  });

  it("accepts Decimal input", () => {
    expect(parseEther(new Decimal("0.5")).toFixed(0)).toBe("500000000000000000");
  });

  it("returns 0 for empty string", () => {
    expect(parseEther("").toFixed(0)).toBe("0");
  });

  it("handles negative values", () => {
    expect(parseEther("-1").toFixed(0)).toBe("-1000000000000000000");
  });

  it("returns 1 wei for the smallest representable fraction", () => {
    expect(parseEther("0.000000000000000001").toFixed(0)).toBe("1");
  });

  it("returns a Decimal instance", () => {
    expect(parseEther("1")).toBeInstanceOf(Decimal);
  });
});
