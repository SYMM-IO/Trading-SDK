import { describe, expect, it } from "vitest";
import type { QuoteFundingData } from "../get-quote-funding/types";
import { makeOptimisticQuote, makeUnifiedQuote } from "../unified-quote.test";
import { aggregateGroupFunding } from "./aggregate-group-funding";

/** Build a funding row that satisfies the row-level `netReceived = received − paid` invariant. */
function makeFundingRow(quoteId: bigint, paid: bigint, received: bigint): QuoteFundingData {
  return { quoteId, paid, received, netReceived: received - paid };
}

/** On-chain child with quote id 1. */
const quote1 = makeUnifiedQuote({ key: "onchain:1", quoteId: 1n });
/** On-chain child with quote id 2. */
const quote2 = makeUnifiedQuote({ key: "onchain:2", quoteId: 2n });
/** On-chain child with quote id 3. */
const quote3 = makeUnifiedQuote({ key: "onchain:3", quoteId: 3n });

/** Quote 1 paid 2 net (paid 3, received 1), i.e. `netReceived` −2. */
const row1 = makeFundingRow(1n, 3_000000000000000000n, 1_000000000000000000n);
/** Quote 2 earned 4 net (paid 1, received 5), i.e. `netReceived` +4. */
const row2 = makeFundingRow(2n, 1_000000000000000000n, 5_000000000000000000n);

describe("aggregateGroupFunding", () => {
  it("returns all zeros and isComplete false for an empty group", () => {
    expect(aggregateGroupFunding([], [])).toEqual({
      paid: 0n,
      received: 0n,
      netReceived: 0n,
      resolvedCount: 0,
      expectedCount: 0,
      missingQuoteIds: [],
      isComplete: false,
    });
  });

  it("sums paid, received, and netReceived across resolved children", () => {
    const funding = aggregateGroupFunding([quote1, quote2], [row1, row2]);
    expect(funding.paid).toBe(4_000000000000000000n);
    expect(funding.received).toBe(6_000000000000000000n);
    expect(funding.resolvedCount).toBe(2);
    expect(funding.expectedCount).toBe(2);
    expect(funding.missingQuoteIds).toEqual([]);
    expect(funding.isComplete).toBe(true);
  });

  it("reports a negative netReceived when the group paid more funding than it earned", () => {
    /** received 1 − paid 3 = −2. */
    const funding = aggregateGroupFunding([quote1], [row1]);
    expect(funding.netReceived).toBe(-2_000000000000000000n);
    expect(funding.netReceived < 0n).toBe(true);
  });

  it("reports a positive netReceived when the group earned more funding than it paid", () => {
    /** received 5 − paid 1 = +4. */
    const funding = aggregateGroupFunding([quote2], [row2]);
    expect(funding.netReceived).toBe(4_000000000000000000n);
    expect(funding.netReceived > 0n).toBe(true);
  });

  it("nets a mixed group down to received − paid across children", () => {
    /** (−2) + (+4) = +2: the group earned funding overall. */
    expect(aggregateGroupFunding([quote1, quote2], [row1, row2]).netReceived).toBe(2_000000000000000000n);
  });

  it("counts a duplicated quoteId once (never double-counts funding)", () => {
    /** The same on-chain quote listed twice — e.g. a child reachable from two sources. */
    const duplicate = makeUnifiedQuote({ key: "onchain:1-dup", quoteId: 1n });
    const funding = aggregateGroupFunding([quote1, duplicate], [row1]);
    expect(funding.paid).toBe(3_000000000000000000n);
    expect(funding.received).toBe(1_000000000000000000n);
    expect(funding.netReceived).toBe(-2_000000000000000000n);
    expect(funding.resolvedCount).toBe(1);
    expect(funding.expectedCount).toBe(1);
    expect(funding.isComplete).toBe(true);
  });

  it("counts a duplicated funding row once", () => {
    const funding = aggregateGroupFunding([quote1], [row1, { ...row1 }]);
    expect(funding.paid).toBe(3_000000000000000000n);
    expect(funding.netReceived).toBe(-2_000000000000000000n);
    expect(funding.resolvedCount).toBe(1);
  });

  it("skips optimistic children without inflating expectedCount", () => {
    const optimistic = makeOptimisticQuote({ tempQuoteId: 9 });
    const funding = aggregateGroupFunding([quote1, optimistic], [row1]);
    expect(funding.expectedCount).toBe(1);
    expect(funding.resolvedCount).toBe(1);
    expect(funding.missingQuoteIds).toEqual([]);
    /** The optimistic child is not "missing" — it simply has nothing to resolve yet. */
    expect(funding.isComplete).toBe(true);
    expect(funding.netReceived).toBe(-2_000000000000000000n);
  });

  it("reports isComplete false with zero amounts for an all-optimistic group", () => {
    /** "Funding unknown", not "no funding" — the caller must not render 0. */
    const funding = aggregateGroupFunding(
      [makeOptimisticQuote({ tempQuoteId: 1 }), makeOptimisticQuote({ tempQuoteId: 2 })],
      [],
    );
    expect(funding).toEqual({
      paid: 0n,
      received: 0n,
      netReceived: 0n,
      resolvedCount: 0,
      expectedCount: 0,
      missingQuoteIds: [],
      isComplete: false,
    });
  });

  it("marks the group incomplete while a child's row has not been indexed", () => {
    const funding = aggregateGroupFunding([quote1, quote2], [row1]);
    expect(funding.missingQuoteIds).toEqual([2n]);
    expect(funding.resolvedCount).toBe(1);
    expect(funding.expectedCount).toBe(2);
    expect(funding.isComplete).toBe(false);
    /** `netReceived` is still exposed — a lower bound over what resolved, never suppressed. */
    expect(funding.netReceived).toBe(-2_000000000000000000n);
  });

  it("preserves the order missing ids first appear in the children", () => {
    const funding = aggregateGroupFunding([quote3, quote1, quote2], [row1]);
    expect(funding.missingQuoteIds).toEqual([3n, 2n]);
  });

  it("lists a duplicated missing id only once", () => {
    const duplicate = makeUnifiedQuote({ key: "onchain:2-dup", quoteId: 2n });
    const funding = aggregateGroupFunding([quote2, duplicate], []);
    expect(funding.missingQuoteIds).toEqual([2n]);
    expect(funding.expectedCount).toBe(1);
    expect(funding.isComplete).toBe(false);
  });

  it("ignores rows whose quoteId is not among the children", () => {
    const stranger = makeFundingRow(999n, 100_000000000000000000n, 0n);
    const funding = aggregateGroupFunding([quote1], [row1, stranger]);
    expect(funding.paid).toBe(3_000000000000000000n);
    expect(funding.netReceived).toBe(-2_000000000000000000n);
    expect(funding.resolvedCount).toBe(1);
    expect(funding.expectedCount).toBe(1);
    expect(funding.isComplete).toBe(true);
  });

  it("is order-independent across both inputs", () => {
    const forward = aggregateGroupFunding([quote1, quote2], [row1, row2]);
    const reversed = aggregateGroupFunding([quote2, quote1], [row2, row1]);
    expect(reversed.paid).toBe(forward.paid);
    expect(reversed.received).toBe(forward.received);
    expect(reversed.netReceived).toBe(forward.netReceived);
    expect(reversed.resolvedCount).toBe(forward.resolvedCount);
    expect(reversed.expectedCount).toBe(forward.expectedCount);
    expect(reversed.isComplete).toBe(forward.isComplete);
  });

  it("does not mutate its inputs", () => {
    const quotes = [quote1, quote2];
    const rows = [row1];
    aggregateGroupFunding(quotes, rows);
    expect(quotes).toEqual([quote1, quote2]);
    expect(rows).toEqual([row1]);
  });
});
