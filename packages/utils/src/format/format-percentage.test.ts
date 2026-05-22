import { describe, expect, it } from "vitest";
import { formatPercentage } from "./format-percentage";

describe("formatPercentage", () => {
  it("formats whole percentages", () => {
    expect(formatPercentage(54)).toBe("54%");
  });

  it("returns '0%' for zero", () => {
    expect(formatPercentage(0)).toBe("0%");
    expect(formatPercentage(0, { withSign: true })).toBe("0%");
  });

  it("strips the negative sign when withSign is off", () => {
    expect(formatPercentage(-54)).toBe("54%");
  });

  it("prepends + with withSign on positive", () => {
    expect(formatPercentage(54, { withSign: true })).toBe("+54%");
  });

  it("prepends - with withSign on negative", () => {
    expect(formatPercentage(-54, { withSign: true })).toBe("-54%");
  });

  it("respects fixedDecimals", () => {
    expect(formatPercentage(54.1, { fixedDecimals: 2 })).toBe("54.10%");
  });

  it("respects thousand separators for large percentages", () => {
    expect(formatPercentage(12345.6, { fixedDecimals: 2 })).toBe("12,345.60%");
  });
});
