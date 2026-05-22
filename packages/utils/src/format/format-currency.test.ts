import { describe, expect, it } from "vitest";
import { formatCompactCurrency } from "./format-compact-currency";
import { formatCurrency } from "./format-currency";

describe("formatCurrency", () => {
  it("formats with the dollar symbol by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.5");
  });

  it("respects fixedDecimals", () => {
    expect(formatCurrency(1234.5, { fixedDecimals: 2 })).toBe("$1,234.50");
  });

  it("formats with code suffix", () => {
    expect(formatCurrency(1234.5, { display: "code", fixedDecimals: 2 })).toBe("1,234.50 USD");
  });

  it("formats with both symbol and code", () => {
    expect(formatCurrency(1234.5, { display: "symbol-code", fixedDecimals: 2 })).toBe("$1,234.50 USD");
  });

  it("places the negative sign before the symbol", () => {
    expect(formatCurrency(-1234.5, { fixedDecimals: 2 })).toBe("-$1,234.50");
  });

  it("falls through to '0' for nullish input", () => {
    expect(formatCurrency(undefined)).toBe("$0");
  });
});

describe("formatCompactCurrency", () => {
  it("formats compact amounts with the dollar symbol", () => {
    expect(formatCompactCurrency(1_500_000)).toBe("$1.5M");
  });

  it("formats compact with code suffix", () => {
    expect(formatCompactCurrency(1_500_000, { display: "code" })).toBe("1.5M USD");
  });

  it("handles negative compact values", () => {
    expect(formatCompactCurrency(-1_234_567, { maxDecimals: 1 })).toBe("-$1.2M");
  });
});
