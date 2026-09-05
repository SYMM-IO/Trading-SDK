import { describe, expect, it } from "vitest";
import { PositionType } from "../../../symmio-contracts/symmio/types";
import type { TpSlConfig } from "../../types";
import { makeBlankTpSl, makeGroupTpSlChild } from "../to-group-tpsl-children.test";
import { planGroupTpSl } from "./plan-group-tpsl";

const CONFIG: TpSlConfig = { minPriceDistancePercent: 0.1, minProfitStopLossSpreadPercent: 0.1 };

describe("planGroupTpSl", () => {
  it("skips a child whose desired state already matches the handler", () => {
    const children = [makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) })];

    const plan = planGroupTpSl({
      children,
      desired: { a: { tp: { triggerPrice: "150" } } },
      pricePrecision: 4,
    });

    expect(plan.sets).toHaveLength(0);
    expect(plan.isNoop).toBe(true);
    expect(plan.skips[0]).toMatchObject({ key: "a", reason: "unchanged" });
  });

  it("treats differently formatted prices at the same precision as unchanged", () => {
    const children = [makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "100.0000", tpState: "new" }) })];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "100" } } }, pricePrecision: 4 });

    expect(plan.isNoop).toBe(true);
  });

  it("writes when only the price type changed", () => {
    const children = [
      makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpPriceType: "markPrice", tpState: "new" }) }),
    ];

    const plan = planGroupTpSl({
      children,
      desired: { a: { tp: { triggerPrice: "150", priceType: "lastPrice" } } },
      pricePrecision: 4,
    });

    expect(plan.sets).toHaveLength(1);
    expect(plan.sets[0]!.tp).toEqual({ triggerPrice: "150.0000", priceType: "lastPrice" });
  });

  it("puts only the changed side on the leg", () => {
    const children = [
      makeGroupTpSlChild({
        key: "a",
        tpsl: makeBlankTpSl({ tp: "150", tpState: "new", sl: "80", slState: "new" }),
      }),
    ];

    const plan = planGroupTpSl({
      children,
      desired: { a: { tp: { triggerPrice: "170" }, sl: { triggerPrice: "80" } } },
      pricePrecision: 2,
    });

    expect(plan.sets).toHaveLength(1);
    expect(plan.sets[0]!.tp).toEqual({ triggerPrice: "170.00", priceType: "markPrice" });
    expect(plan.sets[0]!.sl).toBeUndefined();
  });

  it("turns a cleared side with a live order into a delete", () => {
    const children = [
      makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }) }),
    ];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "" } } }, pricePrecision: 4 });

    expect(plan.deletes).toHaveLength(1);
    expect(plan.deletes[0]).toMatchObject({ key: "a", cohQuoteId: "coh-1", conditionalOrderType: "take_profit" });
    expect(plan.sets).toHaveLength(0);
    expect(plan.isNoop).toBe(false);
  });

  it("drops a cleared side that the handler never accepted", () => {
    const children = [makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) })];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "" } } }, pricePrecision: 4 });

    expect(plan.deletes).toHaveLength(0);
    expect(plan.skips[0]).toMatchObject({ reason: "unchanged" });
  });

  it("cancels one side and writes the other in the same run", () => {
    const children = [
      makeGroupTpSlChild({
        key: "a",
        tpsl: makeBlankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }),
      }),
    ];

    const plan = planGroupTpSl({
      children,
      desired: { a: { tp: { triggerPrice: "" }, sl: { triggerPrice: "80" } } },
      pricePrecision: 2,
    });

    expect(plan.deletes).toHaveLength(1);
    expect(plan.sets).toHaveLength(1);
    expect(plan.sets[0]!.sl).toEqual({ triggerPrice: "80.00", priceType: "markPrice" });
    // The cancel is queued before the write for the same child.
    expect(plan.actions.map((action) => action.action)).toEqual(["delete", "set"]);
  });

  it("skips an off-chain child instead of throwing", () => {
    const children = [makeGroupTpSlChild({ key: "a", quoteId: undefined })];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "150" } } }, pricePrecision: 4 });

    expect(plan.skips[0]).toMatchObject({ reason: "not-anchored" });
  });

  it("skips a child with no open size left", () => {
    const children = [makeGroupTpSlChild({ key: "a", openQuantity: 0n })];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "150" } } }, pricePrecision: 4 });

    expect(plan.skips[0]).toMatchObject({ reason: "no-open-quantity" });
  });

  it("skips a child with no desired entry", () => {
    const children = [makeGroupTpSlChild({ key: "a" }), makeGroupTpSlChild({ key: "b" })];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "150" } } }, pricePrecision: 4 });

    expect(plan.skips).toHaveLength(1);
    expect(plan.skips[0]).toMatchObject({ key: "b", reason: "nothing-to-do" });
  });

  it("stamps the leg quantity from the child's remaining open size", () => {
    const children = [makeGroupTpSlChild({ key: "a", openQuantity: 2_500000000000000000n })];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "150" } } }, pricePrecision: 2 });

    expect(plan.sets[0]!.quantity).toBe("2.5");
  });

  it("marks a child invalid and blocks the submit when validation fails", () => {
    // LONG at mark 100 — a take profit below the mark is the wrong direction.
    const children = [makeGroupTpSlChild({ key: "a", positionType: PositionType.LONG })];

    const plan = planGroupTpSl({
      children,
      desired: { a: { tp: { triggerPrice: "50" } } },
      pricePrecision: 2,
      referencePrice: "100",
      config: CONFIG,
    });

    expect(plan.hasInvalid).toBe(true);
    expect(plan.sets).toHaveLength(0);
    expect(plan.skips[0]!.validation).toMatchObject({ ok: false });
  });

  it("validates the resulting pair, so an untouched side still gates the spread rule", () => {
    const children = [makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ sl: "99.99", slState: "new" }) })];

    const plan = planGroupTpSl({
      children,
      desired: { a: { tp: { triggerPrice: "100.01" } } },
      pricePrecision: 2,
      referencePrice: "100",
      config: { minPriceDistancePercent: 0, minProfitStopLossSpreadPercent: 5 },
    });

    expect(plan.hasInvalid).toBe(true);
  });

  it("skips validation entirely when no reference price is supplied", () => {
    const children = [makeGroupTpSlChild({ key: "a" })];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "1" } } }, pricePrecision: 2 });

    expect(plan.hasInvalid).toBe(false);
    expect(plan.sets).toHaveLength(1);
  });

  it("reports a half-typed price as invalid instead of clearing the side", () => {
    const children = [
      makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }) }),
    ];

    const plan = planGroupTpSl({ children, desired: { a: { tp: { triggerPrice: "1.2.3" } } }, pricePrecision: 2 });

    expect(plan.hasInvalid).toBe(true);
    expect(plan.deletes).toHaveLength(0);
    expect(plan.skips[0]!.validation).toMatchObject({ ok: false, tpError: "Enter a valid price" });
  });

  it("restricts the plan to the requested keys", () => {
    const children = [makeGroupTpSlChild({ key: "a" }), makeGroupTpSlChild({ key: "b" })];
    const desired = { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } };

    const plan = planGroupTpSl({ children, desired, pricePrecision: 2, only: ["b"] });

    expect(plan.actions).toHaveLength(1);
    expect(plan.sets[0]!.key).toBe("b");
  });

  it("preserves input order and is deterministic", () => {
    const children = [
      makeGroupTpSlChild({ key: "a" }),
      makeGroupTpSlChild({ key: "b" }),
      makeGroupTpSlChild({ key: "c" }),
    ];
    const desired = {
      a: { tp: { triggerPrice: "150" } },
      b: { tp: { triggerPrice: "160" } },
      c: { tp: { triggerPrice: "170" } },
    };

    const first = planGroupTpSl({ children, desired, pricePrecision: 2 });
    const second = planGroupTpSl({ children, desired, pricePrecision: 2 });

    expect(first.sets.map((set) => set.key)).toEqual(["a", "b", "c"]);
    expect(first).toEqual(second);
  });
});
