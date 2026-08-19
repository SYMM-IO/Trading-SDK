import { describe, expect, it } from "vitest";
import { summarizeQuoteGroupTpSl } from "./summarize-group-tpsl";
import { makeBlankTpSl, makeGroupTpSlChild } from "./to-group-tpsl-children.test";

/** `100%` as an 18-decimal fixed-point percent. */
const HUNDRED_PERCENT = 100_000000000000000000n;

/** A child of `openQuantity` units at 100, optionally carrying a take-profit. */
function child(key: string, units: bigint, tp?: string, sl?: string) {
  return makeGroupTpSlChild({
    key,
    openQuantity: units * 1_000000000000000000n,
    tpsl: makeBlankTpSl({
      tp: tp ?? "",
      tpState: tp ? "new" : "canceled",
      sl: sl ?? "",
      slState: sl ? "new" : "canceled",
    }),
  });
}

describe("summarizeQuoteGroupTpSl", () => {
  it("reports an empty group as not set", () => {
    const summary = summarizeQuoteGroupTpSl([child("a", 1n), child("b", 1n), child("c", 1n)]);

    expect(summary.isEmpty).toBe(true);
    expect(summary.takeProfit.display).toBe("none");
    expect(summary.takeProfit.count).toBe(0);
    expect(summary.takeProfit.total).toBe(3);
    expect(summary.takeProfit.price).toBeUndefined();
  });

  it("reports a fully covered group with one price as uniform", () => {
    const summary = summarizeQuoteGroupTpSl([child("a", 1n, "150"), child("b", 1n, "150"), child("c", 1n, "150")]);

    expect(summary.takeProfit.display).toBe("uniform");
    expect(summary.takeProfit.price).toBe("150");
    expect(summary.takeProfit.priceType).toBe("markPrice");
    expect(summary.takeProfit.coveragePercent).toBe(HUNDRED_PERCENT);
    expect(summary.isEmpty).toBe(false);
  });

  it("reports a partially covered group as mixed with a count", () => {
    const summary = summarizeQuoteGroupTpSl([child("a", 1n, "150"), child("b", 1n, "150"), child("c", 1n)]);

    expect(summary.takeProfit.display).toBe("mixed");
    expect(summary.takeProfit.count).toBe(2);
    expect(summary.takeProfit.price).toBeUndefined();
  });

  it("demotes to mixed when prices differ", () => {
    const summary = summarizeQuoteGroupTpSl([child("a", 1n, "150"), child("b", 1n, "160")]);

    expect(summary.takeProfit.display).toBe("mixed");
  });

  it("demotes to mixed when only the price type differs", () => {
    const summary = summarizeQuoteGroupTpSl([
      makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpPriceType: "markPrice", tpState: "new" }) }),
      makeGroupTpSlChild({ key: "b", tpsl: makeBlankTpSl({ tp: "150", tpPriceType: "lastPrice", tpState: "new" }) }),
    ]);

    expect(summary.takeProfit.display).toBe("mixed");
    expect(summary.takeProfit.count).toBe(2);
  });

  it("weights coverage by notional, not by child count", () => {
    // 9-unit child uncovered, 1-unit child covered → 10%, not 50%.
    const summary = summarizeQuoteGroupTpSl([child("big", 9n), child("small", 1n, "150")]);

    expect(summary.takeProfit.count).toBe(1);
    expect(summary.takeProfit.coveragePercent).toBe(10_000000000000000000n);
  });

  it("suppresses coverage rather than dividing by zero", () => {
    const summary = summarizeQuoteGroupTpSl([makeGroupTpSlChild({ key: "a", openQuantity: 0n })]);

    expect(summary.totalNotional).toBe(0n);
    expect(summary.takeProfit.coveragePercent).toBeUndefined();
  });

  it("lets a pending edit win over the confirmed snapshot", () => {
    const children = [child("a", 1n, "150"), child("b", 1n, "150")];

    const summary = summarizeQuoteGroupTpSl(children, { overrides: { b: { tp: { triggerPrice: "170" } } } });

    expect(summary.takeProfit.display).toBe("mixed");
    expect(summary.takeProfit.count).toBe(2);
  });

  it("treats an empty override trigger as clearing the side", () => {
    const children = [child("a", 1n, "150"), child("b", 1n, "150")];

    const summary = summarizeQuoteGroupTpSl(children, { overrides: { b: { tp: { triggerPrice: "" } } } });

    expect(summary.takeProfit.count).toBe(1);
    expect(summary.takeProfit.coveragePercent).toBe(50_000000000000000000n);
  });

  it("flags the side as pending while any child is confirming", () => {
    const children = [
      child("a", 1n, "150"),
      makeGroupTpSlChild({ key: "b", tpsl: makeBlankTpSl({ tp: "150", tpState: "confirming" }) }),
    ];

    expect(summarizeQuoteGroupTpSl(children).takeProfit.isPending).toBe(true);
  });

  it("folds both sides independently", () => {
    const summary = summarizeQuoteGroupTpSl([child("a", 1n, "150", "80"), child("b", 1n, undefined, "80")]);

    expect(summary.takeProfit.display).toBe("mixed");
    expect(summary.stopLoss.display).toBe("uniform");
    expect(summary.stopLoss.price).toBe("80");
  });

  it("handles a group with no children", () => {
    const summary = summarizeQuoteGroupTpSl([]);

    expect(summary.childCount).toBe(0);
    expect(summary.isEmpty).toBe(true);
    expect(summary.takeProfit.total).toBe(0);
  });
});
