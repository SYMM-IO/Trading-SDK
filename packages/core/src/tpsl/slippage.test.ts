import { describe, expect, it } from "vitest";
import { PositionType } from "../symmio-contracts/symmio/types";
import { DEFAULT_TPSL_SLIPPAGE_LOWCAPS, priceSlippageCalculation } from "./slippage";

describe("priceSlippageCalculation", () => {
  it("defaults to 90 percent for lowcaps", () => {
    expect(DEFAULT_TPSL_SLIPPAGE_LOWCAPS).toBe(90);
  });

  it("shifts LONG trigger prices DOWN by (1 - slippage/100)", () => {
    // 100 * (1 - 0.9) = 10
    expect(priceSlippageCalculation("100", 90, PositionType.LONG, 4)).toBe("10.0000");
    // 100 * (1 - 0.1) = 90
    expect(priceSlippageCalculation("100", 10, PositionType.LONG, 2)).toBe("90.00");
  });

  it("shifts SHORT trigger prices UP by (1 + slippage/100)", () => {
    // 100 * (1 + 0.9) = 190
    expect(priceSlippageCalculation("100", 90, PositionType.SHORT, 4)).toBe("190.0000");
    // 100 * (1 + 0.1) = 110
    expect(priceSlippageCalculation("100", 10, PositionType.SHORT, 2)).toBe("110.00");
  });

  it("rounds the result to pricePrecision decimals", () => {
    // 1.2345 * 0.9 = 1.11105 → 4dp: 1.1111 (Decimal rounds ROUND_HALF_UP by default)
    const short = priceSlippageCalculation("1.2345", 10, PositionType.SHORT, 4);
    expect(short.split(".")[1]?.length).toBe(4);
  });

  it("returns 0 when slippage is 100 percent on a LONG", () => {
    expect(priceSlippageCalculation("42.5", 100, PositionType.LONG, 2)).toBe("0.00");
  });

  it("passes trigger price through untouched when slippage is 0", () => {
    expect(priceSlippageCalculation("42.5", 0, PositionType.LONG, 4)).toBe("42.5000");
    expect(priceSlippageCalculation("42.5", 0, PositionType.SHORT, 4)).toBe("42.5000");
  });
});
