import { describe, expect, it } from "vitest";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { calculateQuotePnl } from "./calculate-quote-pnl";

const ONE = 10n ** 18n;

describe("calculateQuotePnl", () => {
  it("computes LONG pnl: closedAmount × (closed − open) × +1", () => {
    const { pnl, pnlPercent } = calculateQuotePnl({
      positionType: PositionType.LONG,
      closedAmount: 50n * ONE,
      closedPrice: 90_000_000_000_000_000n,
      openedPrice: 80_000_000_000_000_000n,
      leverage: "10",
    });
    // 50 * 0.01 = 0.5
    expect(Number(pnl)).toBeCloseTo(0.5, 9);
    // 0.5 / 50 / 0.08 * 10 * 100 = 125
    expect(pnlPercent).toBe("125.00");
  });

  it("computes SHORT pnl: closedAmount × (closed − open) × -1", () => {
    const { pnl } = calculateQuotePnl({
      positionType: PositionType.SHORT,
      closedAmount: 50n * ONE,
      closedPrice: 70_000_000_000_000_000n,
      openedPrice: 80_000_000_000_000_000n,
      leverage: "10",
    });
    // -0.01 * -1 = 0.01, * 50 = 0.5
    expect(Number(pnl)).toBeCloseTo(0.5, 9);
  });

  it("returns 0 when nothing has been closed", () => {
    const result = calculateQuotePnl({
      positionType: PositionType.LONG,
      closedAmount: 0n,
      closedPrice: 90_000_000_000_000_000n,
      openedPrice: 80_000_000_000_000_000n,
      leverage: "10",
    });
    expect(result).toEqual({ pnl: "0", pnlPercent: "0" });
  });

  it("returns pnl but 0 percent when openedPrice is zero", () => {
    const { pnl, pnlPercent } = calculateQuotePnl({
      positionType: PositionType.LONG,
      closedAmount: 50n * ONE,
      closedPrice: 90_000_000_000_000_000n,
      openedPrice: 0n,
      leverage: "10",
    });
    expect(Number(pnl)).toBeCloseTo(4.5, 9);
    expect(pnlPercent).toBe("0");
  });
});
