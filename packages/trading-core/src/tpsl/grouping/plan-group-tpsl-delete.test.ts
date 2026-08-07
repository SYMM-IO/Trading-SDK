import { describe, expect, it } from "vitest";
import { planGroupTpSlDelete } from "./plan-group-tpsl-delete";
import { makeBlankTpSl, makeGroupTpSlChild } from "./to-group-tpsl-children.test";

/** A child carrying a live take-profit and stop-loss at the handler. */
function liveBothSides(key: string) {
  return makeGroupTpSlChild({
    key,
    tpsl: makeBlankTpSl({
      tp: "150",
      tpState: "new",
      tpCohQuoteId: `${key}-tp`,
      sl: "80",
      slState: "new",
      slCohQuoteId: `${key}-sl`,
    }),
  });
}

describe("planGroupTpSlDelete", () => {
  it("enumerates take-profit before stop-loss per child, children in order", () => {
    const plan = planGroupTpSlDelete([liveBothSides("a"), liveBothSides("b")]);

    expect(plan.targets.map((target) => `${target.key}:${target.conditionalOrderType}`)).toEqual([
      "a:take_profit",
      "a:stop_loss",
      "b:take_profit",
      "b:stop_loss",
    ]);
    expect(plan.isNoop).toBe(false);
  });

  it("filters to a single side when scoped", () => {
    const plan = planGroupTpSlDelete([liveBothSides("a")], "stop_loss");

    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0]!.conditionalOrderType).toBe("stop_loss");
    expect(plan.targets[0]!.cohQuoteId).toBe("a-sl");
  });

  it("carries the trigger price through for confirmation UI", () => {
    const plan = planGroupTpSlDelete([liveBothSides("a")], "take_profit");

    expect(plan.targets[0]!.triggerPrice).toBe("150");
  });

  it("skips an in-flight side rather than racing the handler", () => {
    const child = makeGroupTpSlChild({
      key: "a",
      tpsl: makeBlankTpSl({ tp: "150", tpState: "confirming", tpCohQuoteId: "coh-1" }),
    });

    const plan = planGroupTpSlDelete([child]);

    expect(plan.targets).toHaveLength(0);
    expect(plan.skipped[0]).toMatchObject({ key: "a", conditionalOrderType: "take_profit", reason: "in-flight" });
  });

  it("skips a side the handler never accepted", () => {
    const child = makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) });

    const plan = planGroupTpSlDelete([child]);

    expect(plan.skipped[0]).toMatchObject({ reason: "no-coh-id" });
  });

  it("skips a live side on a child that never anchored", () => {
    const child = makeGroupTpSlChild({
      key: "a",
      quoteId: undefined,
      tpsl: makeBlankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }),
    });

    const plan = planGroupTpSlDelete([child]);

    expect(plan.skipped[0]).toMatchObject({ reason: "not-anchored" });
  });

  it("ignores sides with no order at all", () => {
    const plan = planGroupTpSlDelete([makeGroupTpSlChild({ key: "a" })]);

    expect(plan.targets).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);
    expect(plan.isNoop).toBe(true);
  });

  it("ignores pending edits — only what the handler holds can be cancelled", () => {
    const plan = planGroupTpSlDelete([makeGroupTpSlChild({ key: "a" })]);

    expect(plan.isNoop).toBe(true);
  });
});
