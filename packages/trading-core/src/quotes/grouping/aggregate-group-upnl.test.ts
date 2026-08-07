import { describe, expect, it } from "vitest";
import { OrderType, PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import { makeOptimisticQuote, makeUnifiedQuote } from "../unified-quote.test";
import { aggregateGroupUpnl } from "./aggregate-group-upnl";

/** 1 unit opened @ 100. */
const long = makeUnifiedQuote({
  key: "onchain:1",
  quantity: 1_000000000000000000n,
  openedPrice: 100_000000000000000000n,
});

/** The same size and entry, short. */
const short = makeUnifiedQuote({
  key: "onchain:2",
  positionType: PositionType.SHORT,
  quantity: 1_000000000000000000n,
  openedPrice: 100_000000000000000000n,
});

/** Mark 110 — 10 above both entries. */
const MARK = 110_000000000000000000n;

describe("aggregateGroupUpnl", () => {
  it("values a long against the mark price", () => {
    const result = aggregateGroupUpnl([long], MARK);
    // 1 × (110 − 100) = +10
    expect(result.upnl).toBe(10_000000000000000000n);
    expect(result.openNotional).toBe(100_000000000000000000n);
    expect(result).toMatchObject({ valuedCount: 1, unvaluedCount: 0, isComplete: true });
  });

  it("gives a short the exact negation of the long", () => {
    expect(aggregateGroupUpnl([short], MARK).upnl).toBe(-aggregateGroupUpnl([long], MARK).upnl);
  });

  it("is zero when the mark price equals the entry", () => {
    const result = aggregateGroupUpnl([long], 100_000000000000000000n);
    expect(result.upnl).toBe(0n);
    expect(result.isComplete).toBe(true);
  });

  it("sums across children and is order-independent", () => {
    const forwards = aggregateGroupUpnl([long, short], MARK);
    const backwards = aggregateGroupUpnl([short, long], MARK);
    // +10 and −10 net out
    expect(forwards.upnl).toBe(0n);
    expect(forwards.openNotional).toBe(200_000000000000000000n);
    expect(backwards).toEqual(forwards);
  });

  it("values the open quantity, not the original quantity", () => {
    const halfClosed = makeUnifiedQuote({
      quantity: 2_000000000000000000n,
      closedAmount: 1_000000000000000000n,
      openedPrice: 100_000000000000000000n,
    });
    // 1 open (not 2) × (110 − 100) = +10
    expect(aggregateGroupUpnl([halfClosed], MARK).upnl).toBe(10_000000000000000000n);
  });

  it("skips a fully closed child without counting it as unvalued", () => {
    const closed = makeUnifiedQuote({
      quantity: 1_000000000000000000n,
      closedAmount: 1_000000000000000000n,
      openedPrice: 100_000000000000000000n,
    });
    expect(aggregateGroupUpnl([closed], MARK)).toEqual({
      upnl: 0n,
      openNotional: 0n,
      valuedCount: 0,
      unvaluedCount: 0,
      isComplete: false,
    });
  });

  it("skips a resting order without counting it as unvalued", () => {
    /**
     * A pending order has no unrealized PnL by definition; counting it would pin
     * `isComplete` to `false` for any group that also holds a live position.
     */
    const resting = makeUnifiedQuote({
      key: "onchain:3",
      quoteStatus: QuoteStatus.PENDING,
      orderType: OrderType.LIMIT,
      openedPrice: 0n,
      quantity: 1_000000000000000000n,
      requestedOpenPrice: 100_000000000000000000n,
    });
    const result = aggregateGroupUpnl([long, resting], MARK);
    expect(result.upnl).toBe(10_000000000000000000n);
    expect(result).toMatchObject({ valuedCount: 1, unvaluedCount: 0, isComplete: true });
  });

  it("reports a position with an unsettled open price as unvalued but still returns the rest", () => {
    /** `upnl` is a lower bound here, never suppressed to zero. */
    const optimistic = makeOptimisticQuote({ quantity: 1_000000000000000000n, orderType: OrderType.MARKET });
    const zeroPriced = makeUnifiedQuote({ key: "onchain:4", openedPrice: 0n, quantity: 1_000000000000000000n });
    const result = aggregateGroupUpnl([long, optimistic, zeroPriced], MARK);
    expect(result.upnl).toBe(10_000000000000000000n);
    expect(result).toMatchObject({ valuedCount: 1, unvaluedCount: 2, isComplete: false });
  });

  it("reports everything unvalued when there is no mark price yet", () => {
    expect(aggregateGroupUpnl([long, short], undefined)).toEqual({
      upnl: 0n,
      openNotional: 0n,
      valuedCount: 0,
      unvaluedCount: 2,
      isComplete: false,
    });
  });

  it("treats a zero mark price as a real price, not as a missing one", () => {
    /** The distinction `decimalPriceToWei` preserves: 0n is a total loss on a long. */
    const result = aggregateGroupUpnl([long], 0n);
    expect(result.upnl).toBe(-100_000000000000000000n);
    expect(result.isComplete).toBe(true);
  });

  it("returns zeros with isComplete false for an empty group", () => {
    expect(aggregateGroupUpnl([], MARK)).toEqual({
      upnl: 0n,
      openNotional: 0n,
      valuedCount: 0,
      unvaluedCount: 0,
      isComplete: false,
    });
  });

  it("is exact where float math would drift", () => {
    const dusty = makeUnifiedQuote({
      quantity: 3_000000000000000000n,
      openedPrice: 100000000000000000n, // 0.1
    });
    // 3 × (0.3 − 0.1) = 0.6 exactly — 0.30000000000000004 in IEEE-754
    expect(aggregateGroupUpnl([dusty], 300000000000000000n).upnl).toBe(600000000000000000n);
  });
});
