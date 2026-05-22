import { describe, expect, it } from "vitest";
import { formatDynamicDecimals } from "./format-dynamic-decimals";

describe("formatDynamicDecimals", () => {
  it("shows 2 significant digits after the first non-zero", () => {
    expect(formatDynamicDecimals(0.000123, 2)).toBe("0.00012");
    expect(formatDynamicDecimals(0.000001223, 2)).toBe("0.0000012");
  });

  it("does not pad trailing zeros for whole-ish numbers", () => {
    expect(formatDynamicDecimals(1223.12321, 2)).toBe("1223.12");
    expect(formatDynamicDecimals(0.1, 2)).toBe("0.1");
  });

  it("returns '0' for zero", () => {
    expect(formatDynamicDecimals(0, 2)).toBe("0");
  });

  it("caps via maxDecimals", () => {
    expect(formatDynamicDecimals(0.0000123456, 3, { maxDecimals: 6 })).toBe("0.000012");
    expect(formatDynamicDecimals(0.0000123456, 3, { maxDecimals: 10 })).toBe("0.0000123");
  });
});
