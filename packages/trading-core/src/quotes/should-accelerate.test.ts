import { describe, expect, it } from "vitest";
import type { ReconcileQuotesResult } from "./reconcile-quotes";
import { shouldAccelerateOnchainReads, shouldAccelerateQuotePolling } from "./should-accelerate";
import { QuoteLifecycle } from "./unified-quote";
import { makeUnifiedQuote } from "./unified-quote.test";

/**
 * The lifecycle stages that pin the accelerate/idle boundary: rows in these
 * stages are mid-transition and must drive faster polling. Asserting against
 * this explicit set (and its complement) locks the boundary so a stray enum
 * value can't silently change behavior.
 */
const ACCELERATING = [
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN,
  QuoteLifecycle.OPTIMISTIC_CLOSE,
  QuoteLifecycle.CLOSE_PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
];

/**
 * Every lifecycle that must NOT trigger acceleration — the settled/terminal
 * stages (`ONCHAIN`, `CLOSED`, `FAILED`).
 */
const NON_ACCELERATING = [QuoteLifecycle.ONCHAIN, QuoteLifecycle.CLOSED, QuoteLifecycle.FAILED];

/**
 * Wrap one or more lifecycle stages into a {@link ReconcileQuotesResult}. The
 * unit only reads `result.quotes[].lifecycle`, so `links` is an empty record.
 *
 * @param lifecycles - One lifecycle per row to place in the result.
 * @returns A reconcile result whose rows carry the given lifecycles.
 */
function makeResult(lifecycles: QuoteLifecycle[]): ReconcileQuotesResult {
  return {
    quotes: lifecycles.map((lifecycle) => makeUnifiedQuote({ lifecycle })),
    links: {},
    pendingAnchors: [],
  } as ReconcileQuotesResult;
}

describe("shouldAccelerateQuotePolling", () => {
  it.each(ACCELERATING)("returns true for a single %s row (mid-transition)", (lifecycle) => {
    expect(shouldAccelerateQuotePolling(makeResult([lifecycle]))).toBe(true);
  });

  it.each(NON_ACCELERATING)("returns false for a single %s row (settled)", (lifecycle) => {
    expect(shouldAccelerateQuotePolling(makeResult([lifecycle]))).toBe(false);
  });

  /** No rows means nothing is transitioning, so polling stays idle. */
  it("returns false for an empty quotes array", () => {
    expect(shouldAccelerateQuotePolling(makeResult([]))).toBe(false);
  });

  /**
   * `.some()` short-circuits on the first transitioning row: a single in-flight
   * close row buried among otherwise-settled rows must still flip polling to fast.
   */
  it("returns true when one transitioning row sits among several settled rows", () => {
    const result = makeResult([
      QuoteLifecycle.ONCHAIN,
      QuoteLifecycle.CLOSED,
      QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
      QuoteLifecycle.FAILED,
    ]);
    expect(shouldAccelerateQuotePolling(result)).toBe(true);
  });

  /** A list of only settled rows must never accelerate. */
  it("returns false when every row is settled", () => {
    expect(shouldAccelerateQuotePolling(makeResult(NON_ACCELERATING))).toBe(false);
  });
});

/** Stages that await an on-chain confirmation — the only ones that accelerate on-chain reads. */
const ONCHAIN_ACCELERATING = [QuoteLifecycle.WRITE_ONCHAIN, QuoteLifecycle.WRITE_ONCHAIN_CLOSE];

/** Stages that must NOT accelerate on-chain reads (off-chain in-flight, or settled). */
const ONCHAIN_NON_ACCELERATING = [
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.OPTIMISTIC_CLOSE,
  QuoteLifecycle.CLOSE_PRICE_FILLED,
  QuoteLifecycle.ONCHAIN,
  QuoteLifecycle.CLOSED,
  QuoteLifecycle.FAILED,
];

describe("shouldAccelerateOnchainReads", () => {
  it.each(ONCHAIN_ACCELERATING)("returns true for a single %s row (awaiting on-chain confirmation)", (lifecycle) => {
    expect(shouldAccelerateOnchainReads(makeResult([lifecycle]))).toBe(true);
  });

  it.each(ONCHAIN_NON_ACCELERATING)(
    "returns false for a single %s row (off-chain in-flight or settled)",
    (lifecycle) => {
      expect(shouldAccelerateOnchainReads(makeResult([lifecycle]))).toBe(false);
    },
  );

  it("returns false for an empty quotes array", () => {
    expect(shouldAccelerateOnchainReads(makeResult([]))).toBe(false);
  });

  it("returns true when one awaiting-confirmation row sits among off-chain/settled rows", () => {
    const result = makeResult([QuoteLifecycle.OPTIMISTIC, QuoteLifecycle.PRICE_FILLED, QuoteLifecycle.WRITE_ONCHAIN]);
    expect(shouldAccelerateOnchainReads(result)).toBe(true);
  });
});
