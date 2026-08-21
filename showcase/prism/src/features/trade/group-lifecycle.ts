import { QuoteLifecycle, type UnifiedQuote } from "@symmio/trading-core";

/**
 * Which stage a grouped position wears when its children disagree — the most
 * attention-worthy one wins, so a close in flight or a failure is visible at the
 * group level rather than hidden behind a settled sibling. The per-child stages
 * are one click away in the expansion.
 */
const LIFECYCLE_PRIORITY: readonly QuoteLifecycle[] = [
  QuoteLifecycle.FAILED,
  QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
  QuoteLifecycle.CLOSE_PRICE_FILLED,
  QuoteLifecycle.OPTIMISTIC_CLOSE,
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN,
  QuoteLifecycle.ONCHAIN,
  QuoteLifecycle.CLOSED,
];

/**
 * The child whose stage the group wears. Its status comes along, so an anchored
 * group still reads `OPENED` / `CLOSE PENDING`.
 *
 * Shared by the grouped row and its details sheet: the two render the same
 * `StatePill`, and a row that says `CLOSE PENDING` next to a sheet that says
 * `OPENED` is the kind of disagreement that costs a trader the trade.
 *
 * @param quotes - The group's children.
 * @returns The representative child, or `undefined` for an empty group.
 */
export function representativeQuote(quotes: readonly UnifiedQuote[]): UnifiedQuote | undefined {
  for (const stage of LIFECYCLE_PRIORITY) {
    const match = quotes.find((quote) => quote.lifecycle === stage);
    if (match) return match;
  }
  return quotes[0];
}
