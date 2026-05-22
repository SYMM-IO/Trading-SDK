import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { decimalToRaw, rawToDecimal } from "./decimal-bridge";

describe("rawToDecimal", () => {
  it("scales a raw bigint down by the given decimals", () => {
    expect(rawToDecimal(1_500_000n, 6).toString()).toBe("1.5");
  });

  it("handles zero", () => {
    expect(rawToDecimal(0n, 18).toString()).toBe("0");
  });

  it("preserves precision at 18 decimals without float drift", () => {
    const raw = 1_234_567_890_123_456_789n;
    expect(rawToDecimal(raw, 18).toString()).toBe("1.234567890123456789");
  });

  it("handles raw amounts smaller than one whole token", () => {
    expect(rawToDecimal(1n, 18).toString()).toBe("1e-18");
  });
});

describe("decimalToRaw", () => {
  it("scales a Decimal up by the given decimals", () => {
    expect(decimalToRaw(new Decimal("1.5"), 6)).toBe(1_500_000n);
  });

  it("truncates digits below the token's smallest unit", () => {
    expect(decimalToRaw(new Decimal("1.234567891"), 6)).toBe(1_234_567n);
  });

  it("does not round up — matches on-chain integer math semantics", () => {
    expect(decimalToRaw(new Decimal("1.9999999"), 6)).toBe(1_999_999n);
  });

  it("round-trips with rawToDecimal at full precision", () => {
    const raw = 987_654_321_000_000_000n;
    expect(decimalToRaw(rawToDecimal(raw, 18), 18)).toBe(raw);
  });
});
