import { describe, expect, it } from "vitest";
import { getPoolOpenQuoteEntryPrice, getPoolOpenQuoteQuantity, getPoolOpenQuoteUpnl } from "./quotes";

describe("normalized pool quote calculations", () => {
  it("accepts the bigint amounts returned by SDK quote reads", () => {
    const quote = {
      quantity: 4_000000000000000000n,
      closedAmount: 1_000000000000000000n,
      openedPrice: 2_000000000000000000n,
      positionType: 0,
    };
    expect(getPoolOpenQuoteEntryPrice(quote)).toBe(2);
    expect(getPoolOpenQuoteQuantity(quote)).toBe(3);
    expect(getPoolOpenQuoteUpnl(quote, 2.5)).toBe(1.5);
  });
});
