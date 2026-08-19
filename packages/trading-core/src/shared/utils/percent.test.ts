import { describe, expect, it } from "vitest";
import { sharePercent } from "./percent";

describe("sharePercent", () => {
  it("returns an 18-decimal fixed-point percent", () => {
    expect(sharePercent(25_000000000000000000n, 100_000000000000000000n)).toBe(25_000000000000000000n);
  });

  it("returns 100% for a full share", () => {
    expect(sharePercent(7n, 7n)).toBe(100_000000000000000000n);
  });

  it("keeps the sign of a negative share", () => {
    expect(sharePercent(-10_000000000000000000n, 100_000000000000000000n)).toBe(-10_000000000000000000n);
  });

  it("returns undefined rather than dividing by zero", () => {
    expect(sharePercent(1n, 0n)).toBeUndefined();
    expect(sharePercent(1n, -1n)).toBeUndefined();
  });
});
