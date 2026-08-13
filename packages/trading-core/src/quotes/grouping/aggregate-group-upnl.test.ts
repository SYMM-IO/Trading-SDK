import { describe, expect, it } from "vitest";
import { OrderType, PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import { makeOptimisticQuote, makeUnifiedQuote } from "../unified-quote.test";
import { aggregateGroupUpnl } from "./aggregate-group-upnl";
import { aggregateGroupMetrics } from "./aggregate-metrics";

/** Locked legs summing to 10 — 10× leverage against a 100-notional child. */
const MARGIN_10 = { cva: 8_000000000000000000n, lf: 2_000000000000000000n, partyAmm: 0n, partyBmm: 0n };

/** 1 unit opened @ 100, 10× — notional 100, margin 10. */
const long = makeUnifiedQuote({
  key: "onchain:1",
  quantity: 1_000000000000000000n,
  requestedOpenPrice: 100_000000000000000000n,
  openedPrice: 100_000000000000000000n,
  lockedValues: MARGIN_10,
});

/** The same size, entry and leverage, short. */
const short = makeUnifiedQuote({
  key: "onchain:2",
  positionType: PositionType.SHORT,
  quantity: 1_000000000000000000n,
  requestedOpenPrice: 100_000000000000000000n,
  openedPrice: 100_000000000000000000n,
  lockedValues: MARGIN_10,
});

/** Mark 110 — 10 above both entries. */
const MARK = 110_000000000000000000n;

/** 1% as an 18-decimal fixed-point percent, the unit both percentages are in. */
const PERCENT = 1_000000000000000000n;

describe("aggregateGroupUpnl", () => {
  it("values a long against the mark price", () => {
    const result = aggregateGroupUpnl([long], MARK);
    // 1 × (110 − 100) = +10
    expect(result.upnl).toBe(10_000000000000000000n);
    expect(result.openNotional).toBe(100_000000000000000000n);
    expect(result.openMargin).toBe(10_000000000000000000n);
    expect(result).toMatchObject({ valuedCount: 1, unvaluedCount: 0, isComplete: true });
  });

  it("returns both percentages: 10% on notional, 100% on margin at 10×", () => {
    const result = aggregateGroupUpnl([long], MARK);
    // 10 / 100 = 10% of the position's value; 10 / 10 = 100% of the capital behind it
    expect(result.returnPercent).toBe(10n * PERCENT);
    expect(result.upnlPercent).toBe(100n * PERCENT);
  });

  it("gives a short the exact negation of the long", () => {
    const shortResult = aggregateGroupUpnl([short], MARK);
    expect(shortResult.upnl).toBe(-aggregateGroupUpnl([long], MARK).upnl);
    /** A loss is a negative percentage, not an absolute one. */
    expect(shortResult.returnPercent).toBe(-10n * PERCENT);
    expect(shortResult.upnlPercent).toBe(-100n * PERCENT);
  });

  it("is zero when the mark price equals the entry", () => {
    const result = aggregateGroupUpnl([long], 100_000000000000000000n);
    expect(result.upnl).toBe(0n);
    expect(result.isComplete).toBe(true);
    /** A flat position returns a real 0%, distinct from the `undefined` of "no basis". */
    expect(result.returnPercent).toBe(0n);
    expect(result.upnlPercent).toBe(0n);
  });

  it("sums across children and is order-independent", () => {
    const forwards = aggregateGroupUpnl([long, short], MARK);
    const backwards = aggregateGroupUpnl([short, long], MARK);
    // +10 and −10 net out
    expect(forwards.upnl).toBe(0n);
    expect(forwards.openNotional).toBe(200_000000000000000000n);
    expect(forwards.openMargin).toBe(20_000000000000000000n);
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

  it("prorates a partially closed child's margin by its remaining open share", () => {
    const halfClosed = makeUnifiedQuote({
      quantity: 2_000000000000000000n,
      closedAmount: 1_000000000000000000n,
      requestedOpenPrice: 100_000000000000000000n,
      openedPrice: 100_000000000000000000n,
      /** 20 locked for 2 units at 10×; half the size is closed, so half the capital is back. */
      lockedValues: { cva: 16_000000000000000000n, lf: 4_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    });
    const result = aggregateGroupUpnl([halfClosed], MARK);
    expect(result.openNotional).toBe(100_000000000000000000n);
    expect(result.openMargin).toBe(10_000000000000000000n);
    /** Still 10× on the open half: 10 uPnL on 10 margin. */
    expect(result.upnlPercent).toBe(100n * PERCENT);
  });

  it("prefers the frozen initialLockedValues over the shrunken current ones", () => {
    /**
     * The contract releases margin as a position closes, so `lockedValues` alone
     * would overstate leverage on a partially closed child. The frozen legs,
     * prorated, are the honest basis — the same preference `aggregateGroupMetrics`
     * applies.
     */
    const partiallyReleased = makeUnifiedQuote({
      quantity: 1_000000000000000000n,
      requestedOpenPrice: 100_000000000000000000n,
      openedPrice: 100_000000000000000000n,
      initialLockedValues: MARGIN_10,
      lockedValues: { cva: 4_000000000000000000n, lf: 1_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    });
    expect(aggregateGroupUpnl([partiallyReleased], MARK).openMargin).toBe(10_000000000000000000n);
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
      openMargin: 0n,
      returnPercent: undefined,
      upnlPercent: undefined,
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
      openMargin: 0n,
      returnPercent: undefined,
      upnlPercent: undefined,
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
      openMargin: 0n,
      returnPercent: undefined,
      upnlPercent: undefined,
      valuedCount: 0,
      unvaluedCount: 0,
      isComplete: false,
    });
  });

  it("reports percentages over the valued subset only, as a lower bound", () => {
    /** One valued child at 10×, one still unpriced: 100% on what could be valued. */
    const optimistic = makeOptimisticQuote({ quantity: 1_000000000000000000n, orderType: OrderType.MARKET });
    const result = aggregateGroupUpnl([long, optimistic], MARK);
    expect(result.isComplete).toBe(false);
    expect(result.upnlPercent).toBe(100n * PERCENT);
  });

  it("folds the group's totals instead of averaging the children's percentages", () => {
    /**
     * A 10× child and a 2× child, each 1 unit @ 100. Total uPnL 20 on total margin
     * 60 → 33.33%. A notional-weighted mean of the two children's own returns
     * (100% and 20%) would say 60% — a number neither position earned.
     */
    const lowLeverage = makeUnifiedQuote({
      key: "onchain:3",
      quantity: 1_000000000000000000n,
      requestedOpenPrice: 100_000000000000000000n,
      openedPrice: 100_000000000000000000n,
      lockedValues: { cva: 40_000000000000000000n, lf: 10_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    });
    const result = aggregateGroupUpnl([long, lowLeverage], MARK);
    expect(result.upnl).toBe(20_000000000000000000n);
    expect(result.openNotional).toBe(200_000000000000000000n);
    expect(result.openMargin).toBe(60_000000000000000000n);
    expect(result.returnPercent).toBe(10n * PERCENT);
    expect(result.upnlPercent).toBe(33_333333333333333333n);
  });

  it("stays consistent with aggregateGroupMetrics: upnlPercent ≈ returnPercent × leverage", () => {
    /**
     * Both folds define leverage as `Σ notional / Σ margin`, so the two percentages
     * differ only by the group's leverage. The tolerance covers the wei each fold
     * truncates independently — an averaging definition would miss by whole points.
     */
    const lowLeverage = makeUnifiedQuote({
      key: "onchain:3",
      quantity: 1_000000000000000000n,
      requestedOpenPrice: 100_000000000000000000n,
      openedPrice: 100_000000000000000000n,
      lockedValues: { cva: 40_000000000000000000n, lf: 10_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    });
    const quotes = [long, lowLeverage];
    const { returnPercent, upnlPercent } = aggregateGroupUpnl(quotes, MARK);
    const { leverage } = aggregateGroupMetrics(quotes);
    const expected = (returnPercent! * leverage!) / 10n ** 18n;
    expect(upnlPercent! - expected).toBeLessThan(1_000000n);
  });

  it("withholds only the margin percentage when the valued children have no locked collateral", () => {
    const unmargined = makeUnifiedQuote({
      quantity: 1_000000000000000000n,
      openedPrice: 100_000000000000000000n,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
    });
    const result = aggregateGroupUpnl([unmargined], MARK);
    /** The position still moved 10% even though there is no capital base to divide by. */
    expect(result.returnPercent).toBe(10n * PERCENT);
    expect(result.upnlPercent).toBeUndefined();
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
