import { describe, expect, it } from "vitest";
import { calculateQuoteLeverage } from "./calculate-quote-leverage";

const ONE = 10n ** 18n;

describe("calculateQuoteLeverage", () => {
  it("returns qty × price / Σ(CVA + LF + partyAmm + partyBmm)", () => {
    const leverage = calculateQuoteLeverage({
      quantity: 10n * ONE,
      requestedOpenPrice: 100n * ONE,
      lockedValues: { cva: 25n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 25n * ONE },
    });
    // 10 * 100 / 100 = 10
    expect(leverage).toBe("10");
  });

  it("falls back to openedPrice when the requested open price is zero", () => {
    const leverage = calculateQuoteLeverage({
      quantity: 10n * ONE,
      requestedOpenPrice: 0n,
      openedPrice: 100n * ONE,
      lockedValues: { cva: 25n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 25n * ONE },
    });
    // 10 * 100 / 100 = 10
    expect(leverage).toBe("10");
  });

  it("returns 0 when the locked-margin sum is zero", () => {
    const leverage = calculateQuoteLeverage({
      quantity: 1n * ONE,
      requestedOpenPrice: 1n * ONE,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
    });
    expect(leverage).toBe("0");
  });
});
