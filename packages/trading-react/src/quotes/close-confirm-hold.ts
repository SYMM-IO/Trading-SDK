import { QuoteLifecycle, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";

/**
 * Next interval (ms) for the close-confirm backoff: double the current delay, capped
 * at `max`. After the immediate refetch the schedule is `first`, `first * 2`, … up to
 * `max`, then steady at `max` until the hold is released.
 *
 * @param current - the current backoff interval (ms).
 * @param max - the ceiling interval (ms).
 */
export function nextCloseConfirmDelay(current: number, max: number): number {
  return Math.min(current * 2, max);
}

/**
 * Whether the chain has acknowledged a close for a quote that is **still present**
 * in the active set. Releases the close-confirm hold when the on-chain status
 * reflects the pending close (`quoteStatus` `CLOSE_PENDING` / `CANCEL_CLOSE_PENDING`),
 * the quote is terminally `CLOSED`, or `closedAmount` caught up to the full
 * `quantity`. A quote that dropped out of the active set entirely (a full close)
 * is handled by the caller, not here.
 */
export function isCloseConfirmedOnchain(quote: UnifiedQuote): boolean {
  if (quote.lifecycle === QuoteLifecycle.CLOSED) return true;
  if (quote.quoteStatus === QuoteStatus.CLOSE_PENDING || quote.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING) {
    return true;
  }
  const closed = quote.closedAmount ?? 0n;
  return quote.quantity > 0n && closed >= quote.quantity;
}

/**
 * Prune the close-confirm hold **in place** against the current active quotes.
 *
 * The hold keeps the managed-quotes on-chain reads accelerated after a close
 * notification until the chain reflects the close — it exists because a rasa
 * instant-close reports `FillMarketOrderInstantClose` while the on-chain read
 * still shows the quote OPENED, and the stateless reconcile would otherwise revert
 * the row to `ONCHAIN` and stop the accelerated poll before the settle lands.
 *
 * Deletes an entry when the chain confirms the close — the row dropped from the
 * active set (full close), or {@link isCloseConfirmedOnchain} for a still-present
 * row — or when its deadline has passed. Returns the ids dropped **only** because
 * their deadline expired without confirmation (a close that never settled), so the
 * caller can surface them; confirmed and absent entries are not returned.
 *
 * @param pending - map of on-chain quoteId → deadline (ms epoch); mutated in place.
 * @param quotes - the current reconciled active quotes.
 * @param now - current time (ms epoch), e.g. `Date.now()`.
 * @returns the quoteIds dropped due to an expired deadline.
 */
export function pruneCloseConfirmHold(
  pending: Map<string, number>,
  quotes: readonly UnifiedQuote[],
  now: number,
): string[] {
  if (pending.size === 0) return [];
  const expired: string[] = [];
  for (const [quoteId, deadline] of pending) {
    const row = quotes.find((quote) => `${quote.quoteId}` === quoteId);
    if (!row || isCloseConfirmedOnchain(row)) {
      pending.delete(quoteId);
      continue;
    }
    if (now > deadline) {
      pending.delete(quoteId);
      expired.push(quoteId);
    }
  }
  return expired;
}
