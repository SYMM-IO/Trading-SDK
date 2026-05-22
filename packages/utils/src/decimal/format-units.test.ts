import { describe, expect, it } from "vitest";
import { formatUnits } from "./format-units";

describe("formatUnits", () => {
  it("converts wei (18 decimals) to ether", () => {
    expect(formatUnits("1000000000000000000", 18).toString()).toBe("1");
  });

  it("converts USDC base units (6 decimals)", () => {
    expect(formatUnits(1_230_000, 6).toString()).toBe("1.23");
  });

  it("returns 0 for undefined input", () => {
    expect(formatUnits(undefined, 18).toString()).toBe("0");
  });
});
