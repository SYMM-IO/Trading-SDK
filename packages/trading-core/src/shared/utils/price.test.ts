import { describe, expect, it } from "vitest";
import { decimalPriceToWei } from "./price";

describe("decimalPriceToWei", () => {
  it("scales a decimal price string to wei", () => {
    expect(decimalPriceToWei("150.5")).toBe(150_500000000000000000n);
    expect(decimalPriceToWei("0.0085")).toBe(8_500000000000000n);
  });

  it("returns a real zero for a zero price", () => {
    expect(decimalPriceToWei("0")).toBe(0n);
  });

  it("returns undefined rather than a fabricated zero for an unusable price", () => {
    /**
     * The regression guard for the −100%-loss bug: a `0n` mark price is a real
     * price, so "no price yet" must never collapse into one.
     */
    expect(decimalPriceToWei("")).toBeUndefined();
    expect(decimalPriceToWei("not-a-price")).toBeUndefined();
    expect(decimalPriceToWei("NaN")).toBeUndefined();
    expect(decimalPriceToWei("Infinity")).toBeUndefined();
  });

  it("rounds past 18 decimals instead of throwing", () => {
    expect(decimalPriceToWei("1.0000000000000000005")).toBe(1_000000000000000001n);
  });
});
