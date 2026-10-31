import { describe, expect, it } from "vitest";
import { buildConditionalOrderLeg } from "./build-conditional-order-leg";

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
      orderType: 2,
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

  it("defaults orderType to the market-best-effort close type (2)", () => {
    const leg = buildConditionalOrderLeg({
      quantity: "1",
      price: "1",
      conditionalPrice: "1",
      priceType: "markPrice",
    });
    expect(leg.orderType).toBe(2);
  });

  it("honors an explicit orderType override", () => {
    const leg = buildConditionalOrderLeg({
      quantity: "1",
      price: "1",
      conditionalPrice: "1",
      priceType: "markPrice",
      orderType: 0,
    });
    expect(leg.orderType).toBe(0);
  });
});
