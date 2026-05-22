import { describe, expect, it } from "vitest";
import { formatCompact } from "./format-compact";

describe("formatCompact", () => {
  it("formats thousands as K", () => {
    expect(formatCompact(1500)).toBe("1.5K");
  });

  it("formats millions as M", () => {
    expect(formatCompact(1_500_000)).toBe("1.5M");
  });

  it("formats billions as B", () => {
    expect(formatCompact(1_500_000_000)).toBe("1.5B");
  });

  it("formats trillions as T", () => {
    expect(formatCompact(1_500_000_000_000)).toBe("1.5T");
  });

  it("formats quadrillions as Q", () => {
    expect(formatCompact(1_500_000_000_000_000)).toBe("1.5Q");
  });

  it("falls back to formatWithCommas under the threshold", () => {
    expect(formatCompact(1500, { threshold: "M" })).toBe("1,500");
    expect(formatCompact(999)).toBe("999");
  });

  it("respects maxDecimals", () => {
    expect(formatCompact(12_345_678, { maxDecimals: 1 })).toBe("12.3M");
  });

  it("handles negatives", () => {
    expect(formatCompact(-1_234_567, { maxDecimals: 1 })).toBe("-1.2M");
  });
});
