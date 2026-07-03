import { describe, expect, it } from "vitest";
import { buildConditionalOrderLeg, TPSL_LEG_ORDER_TYPE_MARKET } from "./build-conditional-order-leg";

describe("buildConditionalOrderLeg", () => {
  it("maps `markPrice` -> wire `market`", () => {
    expect(
      buildConditionalOrderLeg({
        quantity: "10",
        price: "1.0000",
        conditionalPrice: "1.1",
        priceType: "markPrice",
      }),
    ).toEqual({
      quantity: "10",
      price: "1.0000",
      orderType: TPSL_LEG_ORDER_TYPE_MARKET,
      conditionalPrice: "1.1",
      conditionalPriceType: "market",
    });
  });

  it("maps `lastPrice` -> wire `last_close`", () => {
    const leg = buildConditionalOrderLeg({
      quantity: "10",
      price: "1.0",
      conditionalPrice: "1.1",
      priceType: "lastPrice",
    });
    expect(leg.conditionalPriceType).toBe("last_close");
  });

  it("defaults orderType to the market sentinel (1)", () => {
    const leg = buildConditionalOrderLeg({
      quantity: "1",
      price: "1",
      conditionalPrice: "1",
      priceType: "markPrice",
    });
    expect(leg.orderType).toBe(TPSL_LEG_ORDER_TYPE_MARKET);
  });

  it("honors an explicit orderType override", () => {
    const leg = buildConditionalOrderLeg({
      quantity: "1",
      price: "1",
      conditionalPrice: "1",
      priceType: "markPrice",
      orderType: 7,
    });
    expect(leg.orderType).toBe(7);
  });
});
