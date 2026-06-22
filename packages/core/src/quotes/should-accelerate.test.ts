import { describe, expect, it } from "vitest";
import type { ReconcileQuotesResult } from "./reconcile-quotes";
import { shouldAccelerateQuotePolling } from "./should-accelerate";
import { QuoteLifecycle } from "./unified-quote";
import { makeUnifiedQuote } from "./unified-quote.test";

/**
 * The lifecycle stages that pin the accelerate/idle boundary: rows in these
 * stages are mid-transition and must drive faster polling. Asserting against
 * this explicit set (and its complement) locks the boundary so a stray enum
 * value can't silently change behavior.
 */
const ACCELERATING = [QuoteLifecycle.OPTIMISTIC, QuoteLifecycle.PRICE_FILLED, QuoteLifecycle.CLOSING];

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
   * `.some()` short-circuits on the first transitioning row: a single CLOSING
   * row buried among otherwise-settled rows must still flip polling to fast.
   */
  it("returns true when one transitioning row sits among several settled rows", () => {
    const result = makeResult([
      QuoteLifecycle.ONCHAIN,
      QuoteLifecycle.CLOSED,
      QuoteLifecycle.CLOSING,
      QuoteLifecycle.FAILED,
    ]);
    expect(shouldAccelerateQuotePolling(result)).toBe(true);
  });

  /** A list of only settled rows must never accelerate. */
  it("returns false when every row is settled", () => {
    expect(shouldAccelerateQuotePolling(makeResult(NON_ACCELERATING))).toBe(false);
  });
});
