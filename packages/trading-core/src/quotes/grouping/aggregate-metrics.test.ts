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
      notional: 0n,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
      leverage: undefined,
    });
  });

  it("sums size, notional, and locked legs across children", () => {
    const metrics = aggregateGroupMetrics([quoteA, quoteB]);
    expect(metrics.quoteCount).toBe(2);
    expect(metrics.openQuantity).toBe(2_000000000000000000n);
    expect(metrics.quantity).toBe(2_000000000000000000n);
    expect(metrics.notional).toBe(400_000000000000000000n);
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

  it("suppresses weightedOpenPrice while a child has an unsettled open price, but still values notional", () => {
    const optimistic = makeOptimisticQuote({
      key: "temp:9",
      quantity: 1_000000000000000000n,
      requestedOpenPrice: 200_000000000000000000n,
    });
    const metrics = aggregateGroupMetrics([quoteA, optimistic]);
    expect(metrics.weightedOpenPrice).toBeUndefined();
    // notional still uses the requested price as the fallback: 100×1 + 200×1 = 300
    expect(metrics.notional).toBe(300_000000000000000000n);
  });

  it("leaves leverage undefined when there is no partyA margin", () => {
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
