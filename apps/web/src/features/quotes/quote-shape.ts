import { QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";

/**
 * Which set of facts a quote actually carries, and therefore which card template
 * can be drawn for it.
 *
 * Deliberately derived from **data presence**, not from a domain predicate: a row
 * with no `openedPrice` cannot show an entry price or unrealized P&L no matter
 * what the protocol calls it. Running every row through one template is what
 * prints `$0.00` of P&L beside an "Entry" a resting order never traded at.
 */
export type QuoteShape =
  /** No confirmed on-chain struct yet — show the write progress, no id, no P&L. */
  | "in-flight"
  /** On chain, but never filled — show the limit price and the deadline, no P&L. */
  | "resting"
  /** Filled — show size, entry, mark and unrealized P&L. */
  | "position";

/**
 * Classify a quote into the template its data supports.
 *
 * @param quote - The reconciled quote.
 * @returns The shape its available fields can render.
 *
 * @example
 * ```ts
 * quoteShape(optimisticOpen); // "in-flight" — no raw.onchain yet
 * quoteShape(restingLimit);   // "resting"   — on chain, no fill
 * quoteShape(openPosition);   // "position"  — has an openedPrice
 * ```
 */
export function quoteShape(quote: UnifiedQuote): QuoteShape {
  if (quote.raw.onchain === undefined) return "in-flight";
  if (quote.openedPrice !== undefined && quote.openedPrice > 0n) return "position";
  return "resting";
}

/**
 * Whether a close is in flight for this quote — the row is still a position, but
 * it is on its way out. Reads the on-chain status rather than the lifecycle,
 * because an anchored close-pending row keeps `lifecycle: ONCHAIN`.
 */
export function isClosing(quote: UnifiedQuote): boolean {
  return quote.quoteStatus === QuoteStatus.CLOSE_PENDING || quote.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING;
}
