import { describe, expect, it } from "vitest";
import { PositionType } from "../symmio-contracts/symmio/types";
import type { TpSlConfig } from "./types";
import { validateTpSl } from "./validate-tpsl";

const CONFIG: TpSlConfig = {
  minPriceDistancePercent: 1,
  minProfitStopLossSpreadPercent: 2,
};

const BASE = {
  openPrice: "100",
  positionType: PositionType.LONG,
  pricePrecision: 2,
  config: CONFIG,
} as const;

describe("validateTpSl", () => {
  it("passes when only a TP is provided and it clears the sign + distance rules (LONG)", () => {
    expect(validateTpSl({ ...BASE, takeProfitPrice: "110" })).toEqual({ ok: true });
  });

  it("passes when only an SL is provided and it clears the rules (LONG)", () => {
    expect(validateTpSl({ ...BASE, stopLossPrice: "90" })).toEqual({ ok: true });
  });

  it("rejects a negative TP or SL", () => {
    const res = validateTpSl({ ...BASE, takeProfitPrice: "-5", stopLossPrice: "-1" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.tpError).toContain("greater than 0");
      expect(res.slError).toContain("greater than 0");
    }
  });

  it("rejects a LONG TP below the open price (sign rule)", () => {
    const res = validateTpSl({ ...BASE, takeProfitPrice: "90" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.tpError).toContain("above open price");
  });

  it("rejects a LONG SL above the open price (sign rule)", () => {
    const res = validateTpSl({ ...BASE, stopLossPrice: "110" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.slError).toContain("below open price");
  });

  it("rejects a SHORT TP above the open price", () => {
    const res = validateTpSl({
      ...BASE,
      positionType: PositionType.SHORT,
      takeProfitPrice: "110",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.tpError).toContain("below open price");
  });

  it("rejects a SHORT SL below the open price", () => {
    const res = validateTpSl({
      ...BASE,
      positionType: PositionType.SHORT,
      stopLossPrice: "90",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.slError).toContain("above open price");
  });

  it("rejects a TP whose distance percent is under the minimum", () => {
    // 100.5 → 0.5 % < 1 % floor
    const res = validateTpSl({ ...BASE, takeProfitPrice: "100.5" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.tpError).toContain("should be above");
  });

  it("uses `current price` in errors when isOpenPosition is true", () => {
    const res = validateTpSl({ ...BASE, takeProfitPrice: "90", isOpenPosition: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.tpError).toContain("current price");
  });

  it("enforces the min TP↔SL spread when both sides are set", () => {
    // TP 101, SL 99 → spread = |101-99|/100 * 100 = 2 %. Config floor is 2 → passes.
    expect(
      validateTpSl({
        ...BASE,
        config: { ...CONFIG, minPriceDistancePercent: 0.5 },
        takeProfitPrice: "101",
        stopLossPrice: "99",
      }),
    ).toEqual({ ok: true });

    // Bump spread floor to 5 → now fails.
    const res = validateTpSl({
      ...BASE,
      config: { minPriceDistancePercent: 0.5, minProfitStopLossSpreadPercent: 5 },
      takeProfitPrice: "101",
      stopLossPrice: "99",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.tpError).toContain("further apart");
      expect(res.slError).toContain("further apart");
    }
  });

  it("returns ok:true when both sides are omitted", () => {
    expect(validateTpSl({ ...BASE })).toEqual({ ok: true });
  });
});
