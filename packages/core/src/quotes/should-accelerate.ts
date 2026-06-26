import type { ReconcileQuotesResult } from "./reconcile-quotes";
import { QuoteLifecycle } from "./unified-quote";

/**
 * Lifecycle stages that mean a quote is mid-transition and the consumer should
 * poll the on-chain reads faster until it settles. The `WRITE_ONCHAIN(_CLOSE)`
 * stages are explicitly waiting on the on-chain read to confirm an anchor/close,
 * so they accelerate too.
 */
const ACCELERATING_LIFECYCLES = new Set<QuoteLifecycle>([
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN,
  QuoteLifecycle.OPTIMISTIC_CLOSE,
  QuoteLifecycle.CLOSE_PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
  QuoteLifecycle.CLOSING,
]);

/**
 * Decide whether quote polling should run at the accelerated interval.
 *
 * Returns `true` while any row is mid-transition (the open stages `OPTIMISTIC` /
 * `PRICE_FILLED` / `WRITE_ONCHAIN`, or the close stages `OPTIMISTIC_CLOSE` /
 * `CLOSE_PRICE_FILLED` / `WRITE_ONCHAIN_CLOSE` / `CLOSING`) — those rows are waiting
 * on an on-chain change the SDK can only observe by re-reading, so the consumer
 * should shorten its `refetchInterval` until everything settles, then fall back to
 * the idle interval.
 *
 * @param result - The latest reconciliation result.
 * @returns `true` when at least one transitioning row exists.
 *
 * @example
 * ```ts
 * const interval = shouldAccelerateQuotePolling(result) ? 1_500 : 10_000;
 * ```
 */
export function shouldAccelerateQuotePolling(result: ReconcileQuotesResult): boolean {
  return result.quotes.some((quote) => ACCELERATING_LIFECYCLES.has(quote.lifecycle));
}
