import { OrderType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import { QuoteLifecycle, type UnifiedQuote } from "../unified-quote";

/**
 * On-chain statuses of a resting order that has **not** become a position yet.
 * These are the statuses `getPartyAPendingQuotes` returns.
 */
const PENDING_STATUSES = new Set<QuoteStatus>([QuoteStatus.PENDING, QuoteStatus.LOCKED, QuoteStatus.CANCEL_PENDING]);

/**
 * On-chain statuses of an open position (including one with a close in flight).
 * These are the statuses `getPartyAOpenPositions` returns.
 */
const ACTIVE_STATUSES = new Set<QuoteStatus>([
  QuoteStatus.OPENED,
  QuoteStatus.CLOSE_PENDING,
  QuoteStatus.CANCEL_CLOSE_PENDING,
  QuoteStatus.LIQUIDATED_PENDING,
]);

/**
 * Whether a quote is a **resting/pending order** — submitted but not yet an open
 * position.
 *
 * An anchored row is classified by its on-chain {@link QuoteStatus}
 * (`PENDING` / `LOCKED` / `CANCEL_PENDING`). An off-chain optimistic row (no
 * status yet) is pending only when it is a not-yet-filled `LIMIT` order; an
 * optimistic `MARKET` open is treated as an opening position instead.
 *
 * Mutually exclusive with {@link isActivePosition}.
 *
 * @param quote - The unified quote to classify.
 * @returns `true` for a resting/pending order.
 */
export function isPendingOrder(quote: UnifiedQuote): boolean {
  if (quote.quoteStatus !== undefined) return PENDING_STATUSES.has(quote.quoteStatus);
  if (
    quote.lifecycle === QuoteLifecycle.OPTIMISTIC ||
    quote.lifecycle === QuoteLifecycle.PRICE_FILLED ||
    quote.lifecycle === QuoteLifecycle.ONCHAIN
  ) {
    return quote.orderType === OrderType.LIMIT;
  }
  return false;
}

/**
 * Whether a quote is an **active position** — opened (or opening), possibly with
 * a close in flight.
 *
 * An anchored row is classified by its on-chain {@link QuoteStatus}
 * (`OPENED` / `CLOSE_PENDING` / `CANCEL_CLOSE_PENDING` / `LIQUIDATED_PENDING`).
 * A row with no `quoteStatus` yet is classified by lifecycle + order type: an
 * optimistic/price-filled or just-anchored (`ONCHAIN`) `MARKET` open is an active
 * position, while the matching `LIMIT` order is still resting (pending). The
 * `ONCHAIN`-without-`quoteStatus` case is the brief window after a
 * `SendQuoteTransaction` notification anchors the row but before the on-chain poll
 * has returned its full struct — without it the row would drop out of the grouped
 * view for a tick. A `CLOSING` row is always active; terminal rows (`CLOSED` /
 * `CANCELED` / `EXPIRED` / `LIQUIDATED`, or an off-chain `FAILED`) are neither.
 *
 * Mutually exclusive with {@link isPendingOrder}.
 *
 * @param quote - The unified quote to classify.
 * @returns `true` for an active position.
 */
export function isActivePosition(quote: UnifiedQuote): boolean {
  if (quote.quoteStatus !== undefined) return ACTIVE_STATUSES.has(quote.quoteStatus);
  switch (quote.lifecycle) {
    case QuoteLifecycle.OPTIMISTIC:
    case QuoteLifecycle.PRICE_FILLED:
    case QuoteLifecycle.ONCHAIN:
      return quote.orderType !== OrderType.LIMIT;
    case QuoteLifecycle.CLOSING:
      return true;
    default:
      return false;
  }
}

/** Result of {@link partitionQuotes}. */
export interface PartitionedQuotes {
  /** Quotes that are open (or opening) positions. */
  positions: UnifiedQuote[];
  /** Quotes that are resting/pending orders. */
  pending: UnifiedQuote[];
}

/**
 * Split unified quotes into active positions and resting/pending orders — the
 * grouped-view-vs-orders-tab split. Terminal rows (closed / cancelled / expired /
 * liquidated / failed) fall into neither bucket and are dropped, so
 * `positions ∪ pending` is the set of still-live quotes.
 *
 * @param quotes - The unified quotes to split.
 * @returns The `positions` and `pending` buckets, each preserving input order.
 *
 * @example
 * ```ts
 * const { positions, pending } = partitionQuotes(quotes);
 * const groups = groupQuotes(positions, SubAccountIsolationType.MARKET_DIRECTION);
 * ```
 */
export function partitionQuotes(quotes: readonly UnifiedQuote[]): PartitionedQuotes {
  const positions: UnifiedQuote[] = [];
  const pending: UnifiedQuote[] = [];
  for (const quote of quotes) {
    if (isPendingOrder(quote)) pending.push(quote);
    else if (isActivePosition(quote)) positions.push(quote);
  }
  return { positions, pending };
}
