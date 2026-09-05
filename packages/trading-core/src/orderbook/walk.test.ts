import { describe, expect, it } from "vitest";
import type { Orderbook, OrderbookLevel } from "./types";
import { walkOrderbook } from "./walk";

function book(bids: OrderbookLevel[], asks: OrderbookLevel[]): Orderbook {
  return { marketName: "BTCUSDT", bids, asks, lastUpdateId: 1, timestamp: 0 };
}

const twoSided = book(
  [
    { price: 99, size: 1 },
    { price: 98, size: 2 },
    { price: 97, size: 4 },
  ],
  [
    { price: 101, size: 1 },
    { price: 102, size: 2 },
    { price: 103, size: 4 },
  ],
);

describe("walkOrderbook", () => {
  it("fills a buy from the best ask outward", () => {
    const walk = walkOrderbook(twoSided, "buy", 2);

    expect(walk.filledSize).toBe(2);
    expect(walk.filledQuote).toBe(101 + 102);
    expect(walk.averagePrice).toBeCloseTo(101.5, 10);
    expect(walk.bestPrice).toBe(101);
    expect(walk.worstPrice).toBe(102);
    expect(walk.levelsConsumed).toBe(2);
    expect(walk.partial).toBe(false);
  });

  it("fills a sell from the best bid outward", () => {
    const walk = walkOrderbook(twoSided, "sell", 2);

    expect(walk.filledQuote).toBe(99 + 98);
    expect(walk.averagePrice).toBeCloseTo(98.5, 10);
    expect(walk.bestPrice).toBe(99);
    expect(walk.worstPrice).toBe(98);
  });

  it("takes only part of a level when the order is smaller than it", () => {
    const walk = walkOrderbook(twoSided, "buy", 0.4);

    expect(walk.filledSize).toBeCloseTo(0.4, 10);
    expect(walk.filledQuote).toBeCloseTo(40.4, 10);
    expect(walk.averagePrice).toBeCloseTo(101, 10);
    expect(walk.levelsConsumed).toBe(1);
  });

  it("reports slippage as a positive cost for both directions", () => {
    const buy = walkOrderbook(twoSided, "buy", 2);
    const sell = walkOrderbook(twoSided, "sell", 2);

    /** Buy averaged 101.5 against a 101 touch → +0.5/101. */
    expect(buy.slippageBps).toBeCloseTo((0.5 / 101) * 10_000, 6);
    /** Sell averaged 98.5 against a 99 touch → also reported positive. */
    expect(sell.slippageBps).toBeCloseTo((0.5 / 99) * 10_000, 6);
  });

  it("reports zero slippage when the order rests inside the touch level", () => {
    expect(walkOrderbook(twoSided, "buy", 1).slippageBps).toBe(0);
  });

  it("flags a shortfall when the book runs out", () => {
    const walk = walkOrderbook(twoSided, "buy", 100);

    expect(walk.partial).toBe(true);
    expect(walk.requestedSize).toBe(100);
    expect(walk.filledSize).toBe(7);
    expect(walk.levelsConsumed).toBe(3);
    expect(walk.worstPrice).toBe(103);
  });

  it("returns an empty, flagged walk when the side has no depth", () => {
    const walk = walkOrderbook(book([], []), "buy", 1);

    expect(walk).toMatchObject({
      filledSize: 0,
      filledQuote: 0,
      levelsConsumed: 0,
      slippageBps: 0,
      partial: true,
    });
    expect(walk.averagePrice).toBeUndefined();
    expect(walk.bestPrice).toBeUndefined();
  });

  it("does not flag a shortfall when nothing was requested", () => {
    expect(walkOrderbook(twoSided, "buy", 0).partial).toBe(false);
    expect(walkOrderbook(twoSided, "buy", -5).partial).toBe(false);
    expect(walkOrderbook(twoSided, "buy", Number.NaN).partial).toBe(false);
  });

  it("still reports the touch price when nothing is requested", () => {
    expect(walkOrderbook(twoSided, "buy", 0).bestPrice).toBe(101);
  });

  it("carries the requested side and size through", () => {
    const walk = walkOrderbook(twoSided, "sell", 3);

    expect(walk.side).toBe("sell");
    expect(walk.requestedSize).toBe(3);
  });

  it("consumes the whole book exactly when the request matches total depth", () => {
    const walk = walkOrderbook(twoSided, "buy", 7);

    expect(walk.partial).toBe(false);
    expect(walk.filledSize).toBe(7);
    expect(walk.filledQuote).toBe(101 + 2 * 102 + 4 * 103);
  });

  it("skips zero-size levels without counting them as consumed", () => {
    const withHole = book(
      [],
      [
        { price: 101, size: 0 },
        { price: 102, size: 1 },
      ],
    );
    const walk = walkOrderbook(withHole, "buy", 1);

    expect(walk.levelsConsumed).toBe(1);
    expect(walk.filledQuote).toBe(102);
  });
});
