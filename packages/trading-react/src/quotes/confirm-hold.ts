import { QuoteLifecycle, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";

/**
 * Next interval (ms) for a confirm-hold backoff: double the current delay, capped
 * at `max`. After the immediate refetch the schedule is `first`, `first * 2`, … up to
 * `max`, then steady at `max` until the hold is released.
 *
 * @param current - the current backoff interval (ms).
 * @param max - the ceiling interval (ms).
 */
export function nextConfirmDelay(current: number, max: number): number {
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

/**
 * Whether the on-chain read has caught up with an anchored open: the row carries
 * the polled struct (`raw.onchain`), so `getPartyAOpenPositions` /
 * `getPartyAPendingQuotes` have actually returned the quote. A row that exists only
 * because a notification anchored it (`WRITE_ONCHAIN`, or a retained anchor) is
 * **not** confirmed — that row is precisely what the hold is waiting to replace.
 */
export function isOpenConfirmedOnchain(quote: UnifiedQuote): boolean {
  return quote.raw.onchain !== undefined;
}

/**
 * Prune the open-confirm hold **in place** against the current active quotes.
 *
 * The hold chases the on-chain reads after an open-anchor notification
 * (`SendQuoteTransaction` / `SendQuote` / `FillLimitOrderOpen`) until the read
 * returns the quote. The solver emits that frame when it **broadcasts** the
 * transaction, so the single invalidation it triggers races the block and usually
 * loses; without the chase the position stays invisible until something else
 * happens to refetch, because with the notifications socket live there is no idle
 * poll and the accelerated retry only runs while a `WRITE_ONCHAIN` row exists —
 * which requires a pre-chain row from the hedger feed that may already be gone.
 *
 * Mirror of {@link pruneCloseConfirmHold} with one deliberate difference: for a
 * close, a row **absent** from the active set means the close landed; for an open,
 * absence is the very condition being chased, so it keeps the entry.
 *
 * @param pending - map of on-chain quoteId → deadline (ms epoch); mutated in place.
 * @param quotes - the current reconciled active quotes.
 * @param now - current time (ms epoch), e.g. `Date.now()`.
 * @returns the quoteIds dropped due to an expired deadline (an anchor the read never confirmed).
 */
export function pruneOpenConfirmHold(
  pending: Map<string, number>,
  quotes: readonly UnifiedQuote[],
  now: number,
): string[] {
  if (pending.size === 0) return [];
  const expired: string[] = [];
  for (const [quoteId, deadline] of pending) {
    const row = quotes.find((quote) => `${quote.quoteId}` === quoteId);
    if (row && isOpenConfirmedOnchain(row)) {
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

/**
 * Whether the chain has settled a cancel for a quote that is **still present** in the
 * active set — only the terminal `CLOSED` lifecycle counts (`CANCELED` / `EXPIRED` /
 * `CLOSED` on-chain). A quote that dropped out of the active set entirely is the
 * normal outcome and is handled by the caller.
 *
 * Deliberately **not** released on `quoteStatus !== CANCEL_PENDING`: the hold is
 * registered off the cancel-request notification, which the solver publishes around
 * the time the request transaction is broadcast, so the read at that moment usually
 * still says `LOCKED`. Releasing on "not CANCEL_PENDING" would end the chase on that
 * stale pre-request read and leave the row stuck exactly as before. Holding through
 * `LOCKED` → `CANCEL_PENDING` → gone is the point.
 */
export function isCancelConfirmedOnchain(quote: UnifiedQuote): boolean {
  return quote.lifecycle === QuoteLifecycle.CLOSED;
}

/**
 * Prune the cancel-confirm hold **in place** against the current active quotes.
 *
 * The hold chases the on-chain reads after a cancel notification until the chain
 * settles the cancel. It exists because cancelling a `LOCKED` order is a
 * **two-transaction** flow of which only the first is announced:
 * `requestToCancelQuote` moves the quote to `CANCEL_PENDING` and leaves it in
 * `partyAPendingQuotes`, and the solver's later `acceptCancelRequest` — the one that
 * sets `CANCELED` and removes it — publishes no notification frame at all. With the
 * event channel live there is no idle poll and a `CANCEL_PENDING` row does not
 * accelerate anything (its lifecycle is the generic `ONCHAIN`), so without this chase
 * a cancelled order stays on screen until something unrelated happens to refetch.
 *
 * Same shape as {@link pruneCloseConfirmHold}: an entry whose row is **absent** from
 * the active set is confirmed (the accept removed it from the pending array), as is
 * one whose row went terminal ({@link isCancelConfirmedOnchain}). Returns the ids
 * dropped **only** because their deadline passed — a cancel the solver never answered
 * — so the caller can surface them.
 *
 * @param pending - map of on-chain quoteId → deadline (ms epoch); mutated in place.
 * @param quotes - the current reconciled active quotes.
 * @param now - current time (ms epoch), e.g. `Date.now()`.
 * @returns the quoteIds dropped due to an expired deadline.
 */
export function pruneCancelConfirmHold(
  pending: Map<string, number>,
  quotes: readonly UnifiedQuote[],
  now: number,
): string[] {
  if (pending.size === 0) return [];
  const expired: string[] = [];
  for (const [quoteId, deadline] of pending) {
    const row = quotes.find((quote) => `${quote.quoteId}` === quoteId);
    if (!row || isCancelConfirmedOnchain(row)) {
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
