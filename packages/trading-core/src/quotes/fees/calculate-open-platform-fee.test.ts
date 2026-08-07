import { describe, expect, it } from "vitest";
import { WEI } from "../../shared/utils/wei";
import { calculateOpenPlatformFee } from "./calculate-open-platform-fee";

describe("calculateOpenPlatformFee", () => {
  it("computes the fee from the JSDoc example: quantity × openedPrice × openFeeRate / 1e36", () => {
    expect(
      calculateOpenPlatformFee({
        quantity: 100n * WEI,
        openedPrice: 8_838_000_000_000_000n,
        openFeeRate: 120_000_000_000_000n,
      }),
    ).toBe(106_056_000_000_000n);
  });

  it("scales back to 18-decimal wei: all three factors equal to 1e18 give 1e18", () => {
    expect(calculateOpenPlatformFee({ quantity: WEI, openedPrice: WEI, openFeeRate: WEI })).toBe(WEI);
  });

  it("is linear in each factor: doubling the quantity doubles the fee", () => {
    const base = calculateOpenPlatformFee({
      quantity: 100n * WEI,
      openedPrice: 8_838_000_000_000_000n,
      openFeeRate: 120_000_000_000_000n,
    });
    const doubled = calculateOpenPlatformFee({
      quantity: 200n * WEI,
      openedPrice: 8_838_000_000_000_000n,
      openFeeRate: 120_000_000_000_000n,
    });
    expect(doubled).toBe(base * 2n);
  });

  it("is zero when the quantity is zero", () => {
    expect(calculateOpenPlatformFee({ quantity: 0n, openedPrice: WEI, openFeeRate: WEI })).toBe(0n);
  });

  it("is zero when the opened price is zero (unpriced optimistic open)", () => {
    expect(calculateOpenPlatformFee({ quantity: 100n * WEI, openedPrice: 0n, openFeeRate: WEI })).toBe(0n);
  });

  it("is zero when the open-fee rate is zero", () => {
    expect(calculateOpenPlatformFee({ quantity: 100n * WEI, openedPrice: WEI, openFeeRate: 0n })).toBe(0n);
  });

  it("floors toward zero: a product of 3.5 wei yields 3", () => {
    expect(calculateOpenPlatformFee({ quantity: 7n, openedPrice: WEI, openFeeRate: WEI / 2n })).toBe(3n);
  });

  it("floors a sub-wei product down to zero", () => {
    expect(calculateOpenPlatformFee({ quantity: 1n, openedPrice: 1n, openFeeRate: WEI })).toBe(0n);
  });

  it("handles very large factors without overflow (bigint is arbitrary precision)", () => {
    expect(calculateOpenPlatformFee({ quantity: 10n ** 30n, openedPrice: WEI, openFeeRate: WEI })).toBe(10n ** 30n);
  });
});
