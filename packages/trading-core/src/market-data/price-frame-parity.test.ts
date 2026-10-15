import { describe, expect, it } from "vitest";
import { parsePriceFrame } from "../websocket/prices/parse-price-frame";
describe("legacy market price frames", () => {
  it("preserves a single-symbol frame's identity, time, index and funding", () => {
    expect(
      parsePriceFrame(
        JSON.stringify({
          symbol: "DUP",
          symbol_id: 42,
          mark_price: "0.000000000000000001",
          index_price: "2",
          funding_rate: "-0.1",
          timestamp: 123,
        }),
      ),
    ).toEqual([
      {
        name: "DUP",
        symbol: "DUP",
        symbolId: 42,
        markPrice: "0.000000000000000001",
        indexPrice: "2",
        fundingRate: "-0.1",
        time: 123,
      },
    ]);
  });
});
