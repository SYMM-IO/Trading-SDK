import type { QuoteFundingData } from "../get-quote-funding/types";
import type { UnifiedQuote } from "../unified-quote";

/**
 * Aggregated funding for one group of quotes, folded from the per-quote
 * {@link QuoteFundingData} rows the analytics subgraph returned for its children.
 *
 * Every amount is 18-decimal wei `bigint`, matching {@link UnifiedQuote}.
 *
 * **Sign convention** — `net = paid − received`. A **positive** `net` means the
 * group has net-**paid** funding; a negative `net` means it has net-**received**
 * it. This matches {@link QuoteFundingData.net} and the on-chain `int256`. A UI
 * that prefers "green = income" must invert for display at the render layer, not
 * here.
 *
 * **Settled-to-date only** — these totals cover funding the protocol has already
 * charged and the analytics subgraph has indexed. Funding accrued since the last
 * charge is **not** included: it is not indexed anywhere, so it cannot be part of
 * this sum.
 *
 * **Completeness** — `net` is always the sum over the children that *did* resolve,
 * i.e. a lower bound while rows are still missing; it is never suppressed. Read
 * {@link isComplete} to decide whether to trust it, and treat `isComplete: false`
 * as "funding unknown", not as "no funding".
 */
export interface QuoteGroupFunding {
  /** Σ funding partyA paid across the group's resolved children (wei). */
  paid: bigint;
  /** Σ funding partyA received across the group's resolved children (wei). */
  received: bigint;
  /**
   * Σ `paid − received` across the group's resolved children (wei). **Positive =
   * the group net-paid funding**; negative = it net-received it. A lower bound
   * while {@link isComplete} is `false`.
   */
  net: bigint;
  /** Number of distinct child quote ids that produced a funding row. */
  resolvedCount: number;
  /**
   * Number of distinct on-chain quote ids among the children — the rows this
   * group expects. Optimistic children (no `quoteId` yet) are not counted.
   */
  expectedCount: number;
  /**
   * Expected quote ids with no funding row yet (subgraph indexing lag), in the
   * order the ids first appear in the group's children.
   */
  missingQuoteIds: bigint[];
  /**
   * `true` only when the group has at least one on-chain child **and** every one
   * of them resolved — i.e. the amounts above are the group's complete
   * settled-to-date funding.
   *
   * An all-optimistic group (or an empty one) has nothing to resolve and reports
   * `false` with `net: 0n`, so a consumer can tell "funding unknown" apart from
   * "no funding".
   */
  isComplete: boolean;
}

/**
 * Fold the per-quote funding rows of a group's children into a single
 * {@link QuoteGroupFunding}.
 *
 * Behaviour:
 *
 * - **De-duplicated by `quoteId`.** The fold runs over the *distinct* on-chain
 *   ids among `quotes`, so a quote listed twice contributes its funding once.
 *   Duplicate rows for the same id in `rows` are likewise counted once.
 * - **Optimistic children are skipped.** A child with no `quoteId` has nothing to
 *   look up, so it neither inflates `expectedCount` nor lands in
 *   `missingQuoteIds`.
 * - **Extra rows are ignored.** A row whose `quoteId` is not among the children
 *   is never summed — passing a shared, over-fetched row set is safe.
 * - **`net` is never suppressed.** It is the sum over whatever resolved: a lower
 *   bound while `isComplete` is `false`.
 * - **`isComplete` is `expectedCount > 0 && missingQuoteIds.length === 0`.** An
 *   all-optimistic or empty group therefore reports `isComplete: false` with
 *   zero amounts — "funding unknown", not "no funding".
 *
 * Sign convention: `net = paid − received`, so **positive means net-paid**
 * (see {@link QuoteGroupFunding}). The totals are funding **settled to date**;
 * funding accrued since the last charge is not indexed and not included.
 *
 * Do **not** substitute `Σ UnifiedQuote.accumulatedPaidFunding` as a shortcut.
 * That field is the quote's cumulative funding *rate index* on-chain
 * (`accumulatedRate × epochsSinceStart`), not a settled amount — summing it
 * across quotes is dimensionally meaningless and will not equal `net`.
 *
 * Pure, order-independent, no IO. Empty input yields all-zero amounts with
 * `isComplete: false`.
 *
 * @param quotes - The group's child quotes (optimistic children allowed).
 * @param rows - Funding rows fetched for those quotes; extras and duplicates are tolerated.
 * @returns The aggregated funding for the group.
 *
 * @example
 * ```ts
 * const funding = aggregateGroupFunding(group.quotes, rows);
 * if (!funding.isComplete) {
 *   // still indexing — show a loading state rather than "0 funding"
 * } else if (funding.net > 0n) {
 *   // the group has net-paid funding
 * }
 * ```
 */
export function aggregateGroupFunding(
  quotes: readonly UnifiedQuote[],
  rows: readonly QuoteFundingData[],
): QuoteGroupFunding {
  /** Distinct on-chain ids among the children, in first-appearance order. */
  const expectedQuoteIds: bigint[] = [];
  const seenQuoteIds = new Set<bigint>();
  for (const quote of quotes) {
    /** Optimistic / off-chain children have no id to resolve — skip them entirely. */
    if (quote.quoteId === undefined) continue;
    if (seenQuoteIds.has(quote.quoteId)) continue;
    seenQuoteIds.add(quote.quoteId);
    expectedQuoteIds.push(quote.quoteId);
  }

  /** First row per id — a repeated row for the same quote must not double-count. */
  const rowByQuoteId = new Map<bigint, QuoteFundingData>();
  for (const row of rows) {
    if (!rowByQuoteId.has(row.quoteId)) rowByQuoteId.set(row.quoteId, row);
  }

  let paid = 0n;
  let received = 0n;
  let resolvedCount = 0;
  const missingQuoteIds: bigint[] = [];

  /** Folding over the expected ids (not over `quotes`) is what de-duplicates, and what ignores extra rows. */
  for (const quoteId of expectedQuoteIds) {
    const row = rowByQuoteId.get(quoteId);
    if (row === undefined) {
      missingQuoteIds.push(quoteId);
      continue;
    }
    paid += row.paid;
    received += row.received;
    resolvedCount += 1;
  }

  return {
    paid,
    received,
    /** Derived from the sums so the aggregate keeps the row-level `net = paid − received` invariant. */
    net: paid - received,
    resolvedCount,
    expectedCount: expectedQuoteIds.length,
    missingQuoteIds,
    isComplete: expectedQuoteIds.length > 0 && missingQuoteIds.length === 0,
  };
}
