import { describe, expect, it } from "vitest";
import { QuoteStatus } from "../../symmio-contracts/symmio/types";
import { makeOptimisticQuote, makeUnifiedQuote } from "../unified-quote.test";
import { aggregateGroupMetrics } from "./aggregate-metrics";

/** Quote A: 1 @ 100, partyA margin 10 (cva 5 + partyAmm 5) → 10x. */
const quoteA = makeUnifiedQuote({
  key: "onchain:1",
  quantity: 1_000000000000000000n,
  openedPrice: 100_000000000000000000n,
  requestedOpenPrice: 100_000000000000000000n,
  lockedValues: { cva: 5_000000000000000000n, lf: 0n, partyAmm: 5_000000000000000000n, partyBmm: 0n },
});

/** Quote B: 1 @ 300, partyA margin 30 (cva 15 + partyAmm 15) → 10x. */
const quoteB = makeUnifiedQuote({
  key: "onchain:2",
  quantity: 1_000000000000000000n,
  openedPrice: 300_000000000000000000n,
  requestedOpenPrice: 300_000000000000000000n,
  lockedValues: { cva: 15_000000000000000000n, lf: 0n, partyAmm: 15_000000000000000000n, partyBmm: 0n },
});

describe("aggregateGroupMetrics", () => {
  it("returns zeros and undefined optionals for an empty group", () => {
    expect(aggregateGroupMetrics([])).toEqual({
      quoteCount: 0,
      openCount: 0,
      pendingCount: 0,
      quantity: 0n,
      openQuantity: 0n,
      weightedOpenPrice: undefined,
      initialNotional: 0n,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
      leverage: undefined,
    });
  });

  it("sums size, initialNotional, and locked legs across children", () => {
    const metrics = aggregateGroupMetrics([quoteA, quoteB]);
    expect(metrics.quoteCount).toBe(2);
    expect(metrics.openQuantity).toBe(2_000000000000000000n);
    expect(metrics.quantity).toBe(2_000000000000000000n);
    // 1×100 + 1×300 = 400 (initialOpenedPrice unset → requestedOpenPrice)
    expect(metrics.initialNotional).toBe(400_000000000000000000n);
    expect(metrics.lockedValues).toEqual({
      cva: 20_000000000000000000n,
      lf: 0n,
      partyAmm: 20_000000000000000000n,
      partyBmm: 0n,
    });
  });

  it("computes the size-weighted average open price", () => {
    // (100×1 + 300×1) / 2 = 200
    expect(aggregateGroupMetrics([quoteA, quoteB]).weightedOpenPrice).toBe(200_000000000000000000n);
  });

  it("computes blended leverage as an 18-decimal fixed-point bigint", () => {
    // notional 400 / partyA margin 40 = 10.0x
    expect(aggregateGroupMetrics([quoteA, quoteB]).leverage).toBe(10_000000000000000000n);
  });

  it("size-weights the average price (unequal sizes)", () => {
    const big = makeUnifiedQuote({
      key: "onchain:3",
      quantity: 3_000000000000000000n,
      openedPrice: 300_000000000000000000n,
      requestedOpenPrice: 300_000000000000000000n,
    });
    // (100×1 + 300×3) / 4 = 250
    expect(aggregateGroupMetrics([quoteA, big]).weightedOpenPrice).toBe(250_000000000000000000n);
  });

  it("suppresses weightedOpenPrice while a child has an unsettled open price, but still values initialNotional", () => {
    const optimistic = makeOptimisticQuote({
      key: "temp:9",
      quantity: 1_000000000000000000n,
      requestedOpenPrice: 200_000000000000000000n,
    });
    const metrics = aggregateGroupMetrics([quoteA, optimistic]);
    expect(metrics.weightedOpenPrice).toBeUndefined();
    // initialNotional falls back to the requested price when initialOpenedPrice is unset: 100×1 + 200×1 = 300
    expect(metrics.initialNotional).toBe(300_000000000000000000n);
  });

  it("values initialNotional from the original quantity × initialOpenedPrice, frozen at open", () => {
    // Partially-closed, edited-open quote: initialNotional ignores the current open
    // size and the requested/settled prices in favour of the frozen original
    // quantity and initialOpenedPrice.
    const edited = makeUnifiedQuote({
      quantity: 2_000000000000000000n,
      closedAmount: 1_000000000000000000n, // openQuantity 1 — must NOT be used
      initialOpenedPrice: 150_000000000000000000n, // wins over requested/opened
      requestedOpenPrice: 100_000000000000000000n,
      openedPrice: 120_000000000000000000n,
    });
    // 2 × 150 = 300 (openQuantity 1, requested 100, or opened 120 would all differ)
    expect(aggregateGroupMetrics([edited]).initialNotional).toBe(300_000000000000000000n);
  });

  it("leverages original quantity × requestedOpenPrice over frozen initialLockedValues (incl. partyBmm)", () => {
    // Partially-closed quote: leverage stays frozen at open, ignoring the settled
    // price, the shrunken current lockedValues, and the reduced open quantity.
    const partiallyClosed = makeUnifiedQuote({
      quantity: 2_000000000000000000n,
      closedAmount: 1_000000000000000000n, // openQuantity 1, but leverage uses original quantity 2
      requestedOpenPrice: 100_000000000000000000n,
      openedPrice: 120_000000000000000000n, // ignored — the requested price wins while non-zero
      // frozen basis: 5 + 5 + 5 + 5 = 20 (partyBmm included)
      initialLockedValues: {
        cva: 5_000000000000000000n,
        lf: 5_000000000000000000n,
        partyAmm: 5_000000000000000000n,
        partyBmm: 5_000000000000000000n,
      },
      // current (post-close) legs — must NOT be used for leverage
      lockedValues: {
        cva: 1_000000000000000000n,
        lf: 1_000000000000000000n,
        partyAmm: 1_000000000000000000n,
        partyBmm: 1_000000000000000000n,
      },
    });
    // 2 × 100 / 20 = 10.0x (openedPrice 120, current margin 4, or excluding partyBmm would all differ)
    expect(aggregateGroupMetrics([partiallyClosed]).leverage).toBe(10_000000000000000000n);
  });

  it("falls back to openedPrice in the leverage numerator when the requested open price is zero", () => {
    const zeroRequested = makeUnifiedQuote({
      quantity: 1_000000000000000000n,
      requestedOpenPrice: 0n,
      openedPrice: 120_000000000000000000n,
      lockedValues: { cva: 6_000000000000000000n, lf: 6_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    });
    // 1 × 120 / 12 = 10.0x
    expect(aggregateGroupMetrics([zeroRequested]).leverage).toBe(10_000000000000000000n);
  });

  it("leaves leverage undefined when there is no locked margin", () => {
    const noMargin = makeUnifiedQuote({
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
    });
    expect(aggregateGroupMetrics([noMargin]).leverage).toBeUndefined();
  });

  it("counts open vs pending children", () => {
    const pending = makeUnifiedQuote({ key: "onchain:5", quoteStatus: QuoteStatus.PENDING });
    const metrics = aggregateGroupMetrics([quoteA, quoteB, pending]);
    expect(metrics.openCount).toBe(2);
    expect(metrics.pendingCount).toBe(1);
  });
});
