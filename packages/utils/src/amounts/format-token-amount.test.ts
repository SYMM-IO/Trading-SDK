import { describe, expect, it } from "vitest";
import { formatTokenAmount } from "./format-token-amount";

describe("formatTokenAmount", () => {
  it("scales raw bigint by token decimals", () => {
    expect(formatTokenAmount(1_234_567_890n, 6)).toBe("1234.56789");
  });

  it("returns full precision when no maxFractionDigits is given", () => {
    expect(formatTokenAmount(1_234_567_890_123_456_789n, 18)).toBe("1.234567890123456789");
  });

  it("truncates to maxFractionDigits without rounding up", () => {
    expect(formatTokenAmount(1_999_999n, 6, { maxFractionDigits: 2 })).toBe("1.99");
  });

  it("trims trailing zeros by default", () => {
    expect(formatTokenAmount(1_500_000n, 6, { maxFractionDigits: 4 })).toBe("1.5");
  });

  it("preserves trailing zeros when explicitly requested", () => {
    expect(formatTokenAmount(1_000_000n, 6, { maxFractionDigits: 4, trimTrailingZeros: false })).toBe("1.0000");
  });

  it("formats zero", () => {
    expect(formatTokenAmount(0n, 18)).toBe("0");
  });

  it("formats sub-unit amounts at 18 decimals without float drift", () => {
    expect(formatTokenAmount(1n, 18)).toBe("0.000000000000000001");
  });
});
