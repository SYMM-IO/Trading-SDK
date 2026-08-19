import { describe, expect, it } from "vitest";
import { makeBlankTpSl, makeGroupTpSlChild } from "./to-group-tpsl-children.test";
import { toGroupTpSlOrders } from "./to-group-tpsl-orders";

describe("toGroupTpSlOrders", () => {
  it("emits take-profit before stop-loss within a child", () => {
    const orders = toGroupTpSlOrders([
      makeGroupTpSlChild({
        key: "a",
        tpsl: makeBlankTpSl({ tp: "150", tpState: "new", sl: "80", slState: "new" }),
      }),
    ]);

    expect(orders.map((order) => order.conditionalOrderType)).toEqual(["take_profit", "stop_loss"]);
  });

  it("skips sides with no trigger", () => {
    const orders = toGroupTpSlOrders([
      makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) }),
      makeGroupTpSlChild({ key: "b" }),
    ]);

    expect(orders).toHaveLength(1);
    expect(orders[0]!.key).toBe("a");
  });

  it("splits sizePercent by notional so a fully covered group sums to 100%", () => {
    const orders = toGroupTpSlOrders([
      makeGroupTpSlChild({
        key: "a",
        openQuantity: 3_000000000000000000n,
        tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }),
      }),
      makeGroupTpSlChild({
        key: "b",
        openQuantity: 1_000000000000000000n,
        tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }),
      }),
    ]);

    expect(orders[0]!.sizePercent).toBe(75_000000000000000000n);
    expect(orders[1]!.sizePercent).toBe(25_000000000000000000n);
    expect(orders[0]!.sizePercent + orders[1]!.sizePercent).toBe(100_000000000000000000n);
  });

  it("marks an edit-only row as having no live order", () => {
    const orders = toGroupTpSlOrders([makeGroupTpSlChild({ key: "a" })], {
      overrides: { a: { tp: { triggerPrice: "150" } } },
    });

    expect(orders).toHaveLength(1);
    expect(orders[0]!.triggerPrice).toBe("150");
    expect(orders[0]!.hasLiveOrder).toBe(false);
    expect(orders[0]!.cohQuoteId).toBeUndefined();
  });

  it("carries the handler id of a live order through as the delete target", () => {
    const orders = toGroupTpSlOrders([
      makeGroupTpSlChild({
        key: "a",
        tpsl: makeBlankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }),
      }),
    ]);

    expect(orders[0]!.hasLiveOrder).toBe(true);
    expect(orders[0]!.cohQuoteId).toBe("coh-1");
  });

  it("reports zero sizePercent instead of dividing by zero", () => {
    const orders = toGroupTpSlOrders([
      makeGroupTpSlChild({ key: "a", openQuantity: 0n, tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) }),
    ]);

    expect(orders[0]!.sizePercent).toBe(0n);
  });

  it("flags a confirming row as pending", () => {
    const orders = toGroupTpSlOrders([
      makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "confirming" }) }),
    ]);

    expect(orders[0]!.isPending).toBe(true);
    expect(orders[0]!.state).toBe("confirming");
  });
});
