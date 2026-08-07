import { describe, expect, it } from "vitest";
import { WEI } from "../../shared/utils/wei";
import { calculateClosePlatformFee } from "./calculate-close-platform-fee";

describe("calculateClosePlatformFee", () => {
  it("computes the fee from the JSDoc example: quantity × closePrice × closeFeeRate / 1e36", () => {
    expect(
      calculateClosePlatformFee({
        quantity: 100n * WEI,
        closePrice: 8_838_000_000_000_000n,
        closeFeeRate: 120_000_000_000_000n,
      }),
    ).toBe(106_056_000_000_000n);
  });

  it("computes a realistic partial-close fee", () => {
    expect(
      calculateClosePlatformFee({
        quantity: 50n * WEI,
        closePrice: 90_000_000_000_000_000n,
        closeFeeRate: 100_000_000_000_000n,
      }),
    ).toBe(450_000_000_000_000n);
  });

  it("scales back to 18-decimal wei: all three factors equal to 1e18 give 1e18", () => {
    expect(calculateClosePlatformFee({ quantity: WEI, closePrice: WEI, closeFeeRate: WEI })).toBe(WEI);
  });

  it("is linear in each factor: doubling the closed quantity doubles the fee", () => {
    const base = calculateClosePlatformFee({
      quantity: 100n * WEI,
      closePrice: 8_838_000_000_000_000n,
      closeFeeRate: 120_000_000_000_000n,
    });
    const doubled = calculateClosePlatformFee({
      quantity: 200n * WEI,
      closePrice: 8_838_000_000_000_000n,
      closeFeeRate: 120_000_000_000_000n,
    });
    expect(doubled).toBe(base * 2n);
  });

  it("is zero when nothing was closed (quantity is zero)", () => {
    expect(calculateClosePlatformFee({ quantity: 0n, closePrice: WEI, closeFeeRate: WEI })).toBe(0n);
  });

  it("is zero when the close price is zero", () => {
    expect(calculateClosePlatformFee({ quantity: 100n * WEI, closePrice: 0n, closeFeeRate: WEI })).toBe(0n);
  });

  it("is zero when the close-fee rate is zero", () => {
    expect(calculateClosePlatformFee({ quantity: 100n * WEI, closePrice: WEI, closeFeeRate: 0n })).toBe(0n);
  });

  it("floors toward zero: a product of 3.5 wei yields 3", () => {
    expect(calculateClosePlatformFee({ quantity: 7n, closePrice: WEI, closeFeeRate: WEI / 2n })).toBe(3n);
  });

  it("floors a sub-wei product down to zero", () => {
    expect(calculateClosePlatformFee({ quantity: 1n, closePrice: 1n, closeFeeRate: WEI })).toBe(0n);
  });

  it("handles very large factors without overflow (bigint is arbitrary precision)", () => {
    expect(calculateClosePlatformFee({ quantity: 10n ** 30n, closePrice: WEI, closeFeeRate: WEI })).toBe(10n ** 30n);
  });
});
