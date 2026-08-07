import { describe, expect, it } from "vitest";
import { WEI } from "../../shared/utils/wei";
import { PositionType } from "../../symmio-contracts/symmio/types";
import {
  type AccountPosition,
  type CalculateLiquidationPriceInputs,
  calculateLiquidationPrice,
} from "./calculate-liquidation-price";

/**
 * Build the {@link calculateLiquidationPriceInputs} for a single-position account.
 * Amounts are given as human units and scaled to 18-decimal wei, so the tests
 * read as prices/quantities rather than raw `1e18` literals.
 *
 * @param overrides - Fields to override on the default single-position long account.
 * @returns Fully-populated inputs for {@link calculateLiquidationPrice}.
 */
function makeInputs(overrides: Partial<CalculateLiquidationPriceInputs> = {}): CalculateLiquidationPriceInputs {
  return {
    positions: [{ quantity: 2n * WEI, openedPrice: 100n * WEI }],
    positionType: PositionType.LONG,
    allocatedBalance: 50n * WEI,
    lockedCVA: 0n,
    lockedLF: 0n,
    ...overrides,
  };
}

describe("calculateLiquidationPrice", () => {
  it("prices a single long: liquidates below entry by freeBalance / qty", () => {
    /** entry $100 × 2 = $200 notional; $50 free ⇒ (100 − price)·2 = 50 ⇒ price $75. */
    const liq = calculateLiquidationPrice(makeInputs({ positionType: PositionType.LONG }));
    expect(liq).toBe(75n * WEI);
  });

  it("prices a single short: liquidates above entry by freeBalance / qty", () => {
    /** short liquidates on a rise; (price − 100)·2 = 50 ⇒ price $125. */
    const liq = calculateLiquidationPrice(makeInputs({ positionType: PositionType.SHORT }));
    expect(liq).toBe(125n * WEI);
  });

  it("aggregates multiple positions by total quantity and notional", () => {
    /** qtys 1 + 3 = 4; notional 100 + 600 = 700; $100 free ⇒ (700 − 100)/4 = $150. */
    const positions: AccountPosition[] = [
      { quantity: 1n * WEI, openedPrice: 100n * WEI },
      { quantity: 3n * WEI, openedPrice: 200n * WEI },
    ];
    const liq = calculateLiquidationPrice(
      makeInputs({ positions, positionType: PositionType.LONG, allocatedBalance: 100n * WEI }),
    );
    expect(liq).toBe(150n * WEI);
  });

  it("uses open quantity (quantity − closedAmount), not gross quantity", () => {
    /** 5 opened − 3 closed = 2 open at $100 ⇒ same as the 2-unit long: $75. */
    const liq = calculateLiquidationPrice(
      makeInputs({ positions: [{ quantity: 5n * WEI, closedAmount: 3n * WEI, openedPrice: 100n * WEI }] }),
    );
    expect(liq).toBe(75n * WEI);
  });

  it("treats a missing closedAmount as 0n", () => {
    const withDefault = calculateLiquidationPrice(
      makeInputs({ positions: [{ quantity: 2n * WEI, openedPrice: 100n * WEI }] }),
    );
    const withExplicitZero = calculateLiquidationPrice(
      makeInputs({ positions: [{ quantity: 2n * WEI, closedAmount: 0n, openedPrice: 100n * WEI }] }),
    );
    expect(withDefault).toBe(withExplicitZero);
    expect(withDefault).toBe(75n * WEI);
  });

  it("subtracts lockedCVA and lockedLF from allocatedBalance to get freeBalance", () => {
    /** free = 100 − 10 − 5 = 85; long ⇒ (200 − 85)/2 = $57.5. */
    const liq = calculateLiquidationPrice(
      makeInputs({
        positionType: PositionType.LONG,
        allocatedBalance: 100n * WEI,
        lockedCVA: 10n * WEI,
        lockedLF: 5n * WEI,
      }),
    );
    expect(liq).toBe(575n * 10n ** 17n);
  });

  it("skips fully-closed positions (openQty ≤ 0) while keeping the rest", () => {
    const positions: AccountPosition[] = [
      { quantity: 2n * WEI, closedAmount: 2n * WEI, openedPrice: 100n * WEI },
      { quantity: 2n * WEI, openedPrice: 100n * WEI },
    ];
    const liq = calculateLiquidationPrice(makeInputs({ positions, positionType: PositionType.LONG }));
    expect(liq).toBe(75n * WEI);
  });

  it("returns 0n when there are no positions", () => {
    expect(calculateLiquidationPrice(makeInputs({ positions: [] }))).toBe(0n);
  });

  it("returns 0n when every position is fully closed (totalQty is 0n)", () => {
    const liq = calculateLiquidationPrice(
      makeInputs({ positions: [{ quantity: 2n * WEI, closedAmount: 2n * WEI, openedPrice: 100n * WEI }] }),
    );
    expect(liq).toBe(0n);
  });

  it("clamps a long to 0n when freeBalance exceeds notional (no risk at any positive price)", () => {
    /** $300 free covers the whole $200 notional ⇒ negative price ⇒ clamped to 0n. */
    const liq = calculateLiquidationPrice(
      makeInputs({ positionType: PositionType.LONG, allocatedBalance: 300n * WEI }),
    );
    expect(liq).toBe(0n);
  });

  it("reproduces the JSDoc worked example", () => {
    const liq = calculateLiquidationPrice({
      positions: [{ quantity: 1n * WEI, openedPrice: 2000n * WEI }],
      positionType: PositionType.LONG,
      allocatedBalance: 200n * WEI,
      lockedCVA: 10n * WEI,
      lockedLF: 5n * WEI,
    });
    /** notional 2000, free 185 ⇒ (2000 − 185)/1 = $1815. */
    expect(liq).toBe(1815n * WEI);
  });

  it("floors the final division (pure bigint, no rounding up)", () => {
    /** notional 301 over qty 3, no free balance ⇒ 301/3 = 100.333… floored. */
    const positions: AccountPosition[] = [
      { quantity: 1n * WEI, openedPrice: 100n * WEI },
      { quantity: 1n * WEI, openedPrice: 100n * WEI },
      { quantity: 1n * WEI, openedPrice: 101n * WEI },
    ];
    const liq = calculateLiquidationPrice(
      makeInputs({ positions, positionType: PositionType.LONG, allocatedBalance: 0n }),
    );
    expect(liq).toBe(100333333333333333333n);
  });
});
