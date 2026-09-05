import { describe, expect, it } from "vitest";
import { accumulateOrderbook, getOrderbookDepthWithin, getOrderbookSpread, groupOrderbook } from "./aggregate";
import type { Orderbook, OrderbookLevel } from "./types";

function book(bids: OrderbookLevel[], asks: OrderbookLevel[]): Orderbook {
  return { marketName: "BTCUSDT", bids, asks, lastUpdateId: 1, timestamp: 1_700_000_000_000 };
}

describe("groupOrderbook", () => {
  it("rounds bids down and asks up so a group never overstates its price", () => {
    const grouped = groupOrderbook(
      book(
        [
          { price: 100.9, size: 1 },
          { price: 100.4, size: 2 },
        ],
        [
          { price: 101.1, size: 3 },
          { price: 101.6, size: 4 },
        ],
      ),
      1,
    );

    expect(grouped.bids).toEqual([{ price: 100, size: 3 }]);
    expect(grouped.asks).toEqual([{ price: 102, size: 7 }]);
  });

  it("sums sizes of levels that collapse into one bucket", () => {
    const grouped = groupOrderbook(
      book(
        [
          { price: 63018.9, size: 1 },
          { price: 63018.4, size: 2 },
          { price: 63018.1, size: 0.5 },
        ],
        [],
      ),
      1,
    );

    expect(grouped.bids).toEqual([{ price: 63018, size: 3.5 }]);
  });

  it("preserves ordering: bids descending, asks ascending", () => {
    const grouped = groupOrderbook(
      book(
        [
          { price: 102.5, size: 1 },
          { price: 101.5, size: 1 },
          { price: 100.5, size: 1 },
        ],
        [
          { price: 103.5, size: 1 },
          { price: 104.5, size: 1 },
          { price: 105.5, size: 1 },
        ],
      ),
      1,
    );

    expect(grouped.bids.map((level) => level.price)).toEqual([102, 101, 100]);
    expect(grouped.asks.map((level) => level.price)).toEqual([104, 105, 106]);
  });

  it("is a no-op on the venue's own tick", () => {
    const source = book([{ price: 63018.1, size: 1 }], [{ price: 63018.2, size: 2 }]);
    const grouped = groupOrderbook(source, 0.1);

    expect(grouped.bids).toEqual(source.bids);
    expect(grouped.asks).toEqual(source.asks);
  });

  it("carries metadata through unchanged", () => {
    const source = book([{ price: 100, size: 1 }], [{ price: 101, size: 1 }]);
    const grouped = groupOrderbook(source, 10);

    expect(grouped.marketName).toBe("BTCUSDT");
    expect(grouped.lastUpdateId).toBe(1);
    expect(grouped.timestamp).toBe(1_700_000_000_000);
  });

  it("does not mutate the input", () => {
    const source = book([{ price: 100.9, size: 1 }], []);
    groupOrderbook(source, 1);

    expect(source.bids).toEqual([{ price: 100.9, size: 1 }]);
  });
});

describe("accumulateOrderbook", () => {
  it("accumulates inclusively, so the first level is never zero", () => {
    const accumulated = accumulateOrderbook([
      { price: 100, size: 2 },
      { price: 99, size: 3 },
    ]);

    expect(accumulated[0]).toMatchObject({ price: 100, size: 2, total: 2, totalQuote: 200 });
    expect(accumulated[1]).toMatchObject({ price: 99, size: 3, total: 5 });
    expect(accumulated[1]!.totalQuote).toBeCloseTo(497, 10);
  });

  it("ends with the depth of the whole series, the value a depth bar normalizes against", () => {
    const levels = [
      { price: 100, size: 1 },
      { price: 99, size: 2 },
      { price: 98, size: 4 },
    ];
    const accumulated = accumulateOrderbook(levels);

    expect(accumulated.at(-1)!.total).toBe(7);
  });

  it("returns an empty array for an empty side", () => {
    expect(accumulateOrderbook([])).toEqual([]);
  });

  it("does not mutate the input levels", () => {
    const levels = [{ price: 100, size: 2 }];
    accumulateOrderbook(levels);

    expect(levels[0]).toEqual({ price: 100, size: 2 });
  });
});

describe("getOrderbookSpread", () => {
  it("reports the gap between the touch prices", () => {
    const spread = getOrderbookSpread(book([{ price: 99.5, size: 1 }], [{ price: 100.5, size: 1 }]));

    expect(spread).toMatchObject({ bestBid: 99.5, bestAsk: 100.5, spread: 1, midPrice: 100 });
    expect(spread!.spreadBps).toBeCloseTo(100, 6);
  });

  it("is undefined when either side is empty, rather than reporting a locked market", () => {
    expect(getOrderbookSpread(book([], [{ price: 100, size: 1 }]))).toBeUndefined();
    expect(getOrderbookSpread(book([{ price: 100, size: 1 }], []))).toBeUndefined();
    expect(getOrderbookSpread(book([], []))).toBeUndefined();
  });

  it("reports a negative spread when the book is crossed", () => {
    const spread = getOrderbookSpread(book([{ price: 101, size: 1 }], [{ price: 100, size: 1 }]));

    expect(spread!.spread).toBe(-1);
    expect(spread!.spreadBps).toBeLessThan(0);
  });

  it("reads only the touch, ignoring depth behind it", () => {
    const spread = getOrderbookSpread(
      book(
        [
          { price: 99, size: 1 },
          { price: 98, size: 100 },
        ],
        [
          { price: 101, size: 1 },
          { price: 102, size: 100 },
        ],
      ),
    );

    expect(spread).toMatchObject({ bestBid: 99, bestAsk: 101 });
  });
});

describe("getOrderbookDepthWithin", () => {
  const wide = book(
    [
      { price: 99, size: 1 },
      { price: 98, size: 2 },
      { price: 50, size: 1000 },
    ],
    [
      { price: 101, size: 1 },
      { price: 102, size: 1 },
      { price: 150, size: 1000 },
    ],
  );

  it("counts only levels inside the band", () => {
    const summary = getOrderbookDepthWithin(wide, 0.03);

    expect(summary.bidSize).toBe(3);
    expect(summary.askSize).toBe(2);
    expect(summary.bidQuote).toBeCloseTo(99 + 196, 10);
    expect(summary.askQuote).toBeCloseTo(101 + 102, 10);
  });

  it("is unmoved by a far-out wall that dominates raw totals", () => {
    const narrow = getOrderbookDepthWithin(wide, 0.03);
    const wider = getOrderbookDepthWithin(wide, 0.6);

    expect(narrow.bidSize).toBe(3);
    expect(wider.bidSize).toBe(1003);
  });

  it("reports positive imbalance when bid notional leads", () => {
    const summary = getOrderbookDepthWithin(book([{ price: 100, size: 3 }], [{ price: 100, size: 1 }]), 0.01);

    expect(summary.imbalance).toBeCloseTo(0.5, 10);
  });

  it("reports negative imbalance when ask notional leads", () => {
    const summary = getOrderbookDepthWithin(book([{ price: 100, size: 1 }], [{ price: 100, size: 3 }]), 0.01);

    expect(summary.imbalance).toBeCloseTo(-0.5, 10);
  });

  it("reports zero imbalance for a balanced band", () => {
    const summary = getOrderbookDepthWithin(book([{ price: 100, size: 1 }], [{ price: 100, size: 1 }]), 0.01);

    expect(summary.imbalance).toBe(0);
  });

  it("returns an all-zero summary when the book has no mid", () => {
    expect(getOrderbookDepthWithin(book([], []), 0.01)).toEqual({
      percent: 0.01,
      bidSize: 0,
      askSize: 0,
      bidQuote: 0,
      askQuote: 0,
      imbalance: 0,
    });
  });

  it("reports zero imbalance when the band excludes every level", () => {
    const summary = getOrderbookDepthWithin(book([{ price: 50, size: 1 }], [{ price: 150, size: 1 }]), 0.0001);

    expect(summary).toMatchObject({ bidSize: 0, askSize: 0, imbalance: 0 });
  });
});
