import { describe, expect, it } from "vitest";
import { parseTokenAmount } from "./parse-token-amount";

describe("parseTokenAmount", () => {
  it("scales a decimal string up by token decimals", () => {
    expect(parseTokenAmount("1234.5", 6)).toBe(1_234_500_000n);
  });

  it("accepts comma as a decimal separator", () => {
    expect(parseTokenAmount("1,5", 6)).toBe(1_500_000n);
  });

  it("strips surrounding whitespace", () => {
    expect(parseTokenAmount("  2.0  ", 6)).toBe(2_000_000n);
  });

  it("treats empty string as zero", () => {
    expect(parseTokenAmount("", 18)).toBe(0n);
  });

  it("handles integer inputs", () => {
    expect(parseTokenAmount("42", 18)).toBe(42n * 10n ** 18n);
  });

  it("throws on a non-numeric input", () => {
    expect(() => parseTokenAmount("not-a-number", 6)).toThrow();
  });
});
