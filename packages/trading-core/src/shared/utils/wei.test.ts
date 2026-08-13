import { describe, expect, it } from "vitest";
import { mulWei, WEI } from "./wei";

describe("mulWei", () => {
  it("rescales a quantity × price product back to wei", () => {
    expect(mulWei(2_000000000000000000n, 150_000000000000000000n)).toBe(300_000000000000000000n);
  });

  it("keeps the sign of a negative factor", () => {
    expect(mulWei(2_000000000000000000n, -150_000000000000000000n)).toBe(-300_000000000000000000n);
  });

  it("returns zero when either factor is zero", () => {
    expect(mulWei(0n, 150_000000000000000000n)).toBe(0n);
    expect(mulWei(2_000000000000000000n, 0n)).toBe(0n);
  });

  it("truncates toward zero rather than rounding", () => {
    /** 1 wei of quantity at half a wei of price: the true product is 0.5 wei. */
    expect(mulWei(1n, WEI / 2n)).toBe(0n);
    expect(mulWei(-1n, WEI / 2n)).toBe(0n);
    /** 3.5 wei truncates down to 3, and -3.5 truncates up to -3 — toward zero, not down. */
    expect(mulWei(7n, WEI / 2n)).toBe(3n);
    expect(mulWei(-7n, WEI / 2n)).toBe(-3n);
  });

  it("loses at most 1 wei per call, so a per-item fold stays order-independent", () => {
    const terms = [7n, -7n, 3n, WEI + 1n];
    const forwards = terms.reduce((sum, term) => sum + mulWei(term, WEI / 2n), 0n);
    const backwards = [...terms].reverse().reduce((sum, term) => sum + mulWei(term, WEI / 2n), 0n);
    expect(forwards).toBe(backwards);
  });
});
