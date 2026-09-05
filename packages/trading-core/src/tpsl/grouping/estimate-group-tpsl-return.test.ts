import { describe, expect, it } from "vitest";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { estimateGroupTpSlReturn } from "./estimate-group-tpsl-return";
import { makeBlankTpSl, makeGroupTpSlChild } from "./to-group-tpsl-children.test";

describe("estimateGroupTpSlReturn", () => {
  it("returns a profit for a LONG take-profit above the open price", () => {
    // 2 units opened at 100, take profit at 150 → +100.
    const estimate = estimateGroupTpSlReturn(
      [
        makeGroupTpSlChild({
          key: "a",
          openQuantity: 2_000000000000000000n,
          tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }),
        }),
      ],
      { conditionalOrderType: "take_profit" },
    );

    expect(estimate.totalPnl).toBe(100_000000000000000000n);
    expect(estimate.totalNotional).toBe(200_000000000000000000n);
    expect(estimate.returnPercent).toBe(50_000000000000000000n);
  });

  it("flips the sign for a SHORT", () => {
    // 2 units SHORT at 100, take profit at 80 → +40.
    const estimate = estimateGroupTpSlReturn(
      [
        makeGroupTpSlChild({
          key: "a",
          positionType: PositionType.SHORT,
          openQuantity: 2_000000000000000000n,
          tpsl: makeBlankTpSl({ tp: "80", tpState: "new" }),
        }),
      ],
      { conditionalOrderType: "take_profit" },
    );

    expect(estimate.totalPnl).toBe(40_000000000000000000n);
  });

  it("reports a loss for a stop-loss below the open price", () => {
    const estimate = estimateGroupTpSlReturn(
      [makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ sl: "80", slState: "new" }) })],
      { conditionalOrderType: "stop_loss" },
    );

    expect(estimate.totalPnl).toBe(-20_000000000000000000n);
    expect(estimate.returnPercent).toBe(-20_000000000000000000n);
  });

  it("weights children by their own open price and size", () => {
    const estimate = estimateGroupTpSlReturn(
      [
        makeGroupTpSlChild({
          key: "a",
          openQuantity: 1_000000000000000000n,
          openPrice: 100_000000000000000000n,
          tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }),
        }),
        makeGroupTpSlChild({
          key: "b",
          openQuantity: 1_000000000000000000n,
          openPrice: 200_000000000000000000n,
          tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }),
        }),
      ],
      { conditionalOrderType: "take_profit" },
    );

    // +50 on the first child, −50 on the second.
    expect(estimate.totalPnl).toBe(0n);
    expect(estimate.legs).toHaveLength(2);
    expect(estimate.legs[0]!.pnl).toBe(50_000000000000000000n);
    expect(estimate.legs[1]!.pnl).toBe(-50_000000000000000000n);
  });

  it("ignores children with no trigger on the requested side", () => {
    const estimate = estimateGroupTpSlReturn(
      [
        makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) }),
        makeGroupTpSlChild({ key: "b" }),
      ],
      { conditionalOrderType: "take_profit" },
    );

    expect(estimate.legs).toHaveLength(1);
    expect(estimate.totalNotional).toBe(100_000000000000000000n);
  });

  it("uses pending edits over the confirmed snapshot", () => {
    const estimate = estimateGroupTpSlReturn(
      [makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) })],
      { conditionalOrderType: "take_profit", overrides: { a: { tp: { triggerPrice: "200" } } } },
    );

    expect(estimate.totalPnl).toBe(100_000000000000000000n);
  });

  it("suppresses returnPercent when nothing contributes", () => {
    const estimate = estimateGroupTpSlReturn([makeGroupTpSlChild({ key: "a" })], {
      conditionalOrderType: "take_profit",
    });

    expect(estimate.legs).toHaveLength(0);
    expect(estimate.totalNotional).toBe(0n);
    expect(estimate.returnPercent).toBeUndefined();
  });

  it("does not depend on leverage — locked margin never enters the formula", () => {
    // Two children identical in size/price/trigger. Nothing about margin is an
    // input, so a 1x and a 50x leg must estimate the same.
    const lowLeverage = makeGroupTpSlChild({ key: "a", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) });
    const highLeverage = makeGroupTpSlChild({ key: "b", tpsl: makeBlankTpSl({ tp: "150", tpState: "new" }) });

    const first = estimateGroupTpSlReturn([lowLeverage], { conditionalOrderType: "take_profit" });
    const second = estimateGroupTpSlReturn([highLeverage], { conditionalOrderType: "take_profit" });

    expect(first.totalPnl).toBe(second.totalPnl);
    expect(first.returnPercent).toBe(second.returnPercent);
  });
});
