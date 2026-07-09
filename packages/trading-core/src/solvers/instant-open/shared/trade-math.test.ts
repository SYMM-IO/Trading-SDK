import { describe, expect, it } from "vitest";
import { calculateAvailableInstantOpenMargin } from "./trade-math";
import { PositionType } from "./types";

const E18 = 10n ** 18n;

/**
 * Fixture: 1000 collateral, 0.1% open + 0.1% close fee, 10x, 5% slippage.
 * LONG shaves fees only; SHORT also caps at (1 − slippage).
 */
const BASE = {
  balance: 1000n * E18,
  openFee: E18 / 1000n, // 0.1%
  closeFee: E18 / 1000n, // 0.1%
  slippageFractionWei: 5n * 10n ** 16n, // 5%
  leverage: 10,
};

describe("calculateAvailableInstantOpenMargin", () => {
  it("LONG shaves fees only, ignores slippage", () => {
    // feeMultiplier = 1 − 10 × (0.001 + 0.001) = 0.98 ; slippage ignored -> 980
    expect(calculateAvailableInstantOpenMargin({ ...BASE, positionType: PositionType.LONG })).toBe(980n * E18);
  });

  it("SHORT also applies the slippage cap", () => {
    // 1000 × (1 − 0.05) × 0.98 = 931
    expect(calculateAvailableInstantOpenMargin({ ...BASE, positionType: PositionType.SHORT })).toBe(931n * E18);
  });

  it("returns 0n when slippage ≥ 100% on SHORT", () => {
    expect(
      calculateAvailableInstantOpenMargin({ ...BASE, slippageFractionWei: E18, positionType: PositionType.SHORT }),
    ).toBe(0n);
  });

  it("returns 0n when leverage × total fee ≥ 100%", () => {
    // 500 × (0.001 + 0.001) = 1.0
    expect(calculateAvailableInstantOpenMargin({ ...BASE, leverage: 500, positionType: PositionType.LONG })).toBe(0n);
  });

  it("returns the full balance with no fees and no slippage (LONG)", () => {
    expect(
      calculateAvailableInstantOpenMargin({
        balance: 1000n * E18,
        openFee: 0n,
        closeFee: 0n,
        slippageFractionWei: 0n,
        leverage: 10,
        positionType: PositionType.LONG,
      }),
    ).toBe(1000n * E18);
  });
});
