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

  it("prefers initialOpenedPrice over openedPrice and requestedOpenPrice", () => {
    const leverage = calculateQuoteLeverage({
      quantity: 10n * ONE,
      initialOpenedPrice: 100n * ONE,
      openedPrice: 200n * ONE,
      requestedOpenPrice: 300n * ONE,
      lockedValues: { cva: 25n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 25n * ONE },
    });
    // 10 * 100 / 100 = 10 — initialOpenedPrice wins.
    expect(leverage).toBe("10");
  });

  it("uses openedPrice over requestedOpenPrice when no initial price is set", () => {
    const leverage = calculateQuoteLeverage({
      quantity: 10n * ONE,
      openedPrice: 100n * ONE,
      requestedOpenPrice: 300n * ONE,
      lockedValues: { cva: 25n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 25n * ONE },
    });
    // 10 * 100 / 100 = 10 — settled fill wins over the (drift-prone) requested price.
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
