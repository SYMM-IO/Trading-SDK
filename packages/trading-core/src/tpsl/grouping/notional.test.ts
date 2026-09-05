import { describe, expect, it } from "vitest";
import { childNotional, triggerPriceToWei } from "./notional";

describe("childNotional", () => {
  it("multiplies open size by open price and rescales to wei", () => {
    expect(childNotional({ openQuantity: 2_000000000000000000n, openPrice: 150_000000000000000000n })).toBe(
      300_000000000000000000n,
    );
  });

  it("is zero for a fully closed child", () => {
    expect(childNotional({ openQuantity: 0n, openPrice: 150_000000000000000000n })).toBe(0n);
  });
});

describe("triggerPriceToWei", () => {
  it("scales a decimal price string to wei", () => {
    expect(triggerPriceToWei("150.5")).toBe(150_500000000000000000n);
  });

  it("returns zero for an empty or non-numeric price", () => {
    /** `0n` is the handler's "no trigger on this side" sentinel — the delegate must preserve it. */
    expect(triggerPriceToWei("")).toBe(0n);
    expect(triggerPriceToWei("not-a-price")).toBe(0n);
  });

  it("rounds past 18 decimals instead of throwing", () => {
    expect(triggerPriceToWei("1.0000000000000000005")).toBe(1_000000000000000001n);
  });
});
