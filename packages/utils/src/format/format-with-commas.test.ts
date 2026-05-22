import { describe, expect, it } from "vitest";
import { RoundingMode } from "../decimal/config";
import { formatWithCommas } from "./format-with-commas";

describe("formatWithCommas", () => {
  it("returns '0' for nullish input", () => {
    expect(formatWithCommas(undefined)).toBe("0");
    expect(formatWithCommas(null)).toBe("0");
  });

  it("formats integers with thousand separators", () => {
    expect(formatWithCommas(1234567)).toBe("1,234,567");
  });

  it("preserves the value's natural decimal precision when no option is given", () => {
    expect(formatWithCommas(1234.56)).toBe("1,234.56");
  });

  it("pads with trailing zeros when fixedDecimals is set", () => {
    expect(formatWithCommas(1234.4, { fixedDecimals: 4 })).toBe("1,234.4000");
  });

  it("caps at maxDecimals without padding", () => {
    expect(formatWithCommas(1234.123456, { maxDecimals: 5 })).toBe("1,234.12345");
    expect(formatWithCommas(1234.123, { maxDecimals: 5 })).toBe("1,234.123");
  });

  it("respects rounding mode", () => {
    expect(formatWithCommas(0.129, { maxDecimals: 2, rounding: RoundingMode.ROUND_FLOOR })).toBe("0.12");
    expect(formatWithCommas(0.129, { maxDecimals: 2, rounding: RoundingMode.ROUND_CEIL })).toBe("0.13");
  });

  it("handles negative values", () => {
    expect(formatWithCommas(-1234.5)).toBe("-1,234.5");
  });

  it("uses dynamic decimals when requested", () => {
    expect(formatWithCommas(0.000123, { dynamicDecimals: 2 })).toBe("0.00012");
    expect(formatWithCommas(1223.12321, { dynamicDecimals: 2 })).toBe("1,223.12");
    expect(formatWithCommas(0.1, { dynamicDecimals: 2 })).toBe("0.1");
  });
});
