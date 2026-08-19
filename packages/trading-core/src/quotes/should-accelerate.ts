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
]);

/**
 * Decide whether quote polling should run at the accelerated interval.
 *
 * Returns `true` while any row is mid-transition (the open stages `OPTIMISTIC` /
 * `PRICE_FILLED` / `WRITE_ONCHAIN`, or the close stages `OPTIMISTIC_CLOSE` /
 * `CLOSE_PRICE_FILLED` / `WRITE_ONCHAIN_CLOSE`) — those rows are waiting on an
 * on-chain change the SDK can only observe by re-reading, so the consumer should
 * shorten its `refetchInterval` until everything settles, then fall back to the
 * idle interval. Once a close is confirmed on-chain (`ONCHAIN` with
 * `quoteStatus: CLOSE_PENDING`) it no longer accelerates here — a market close's
 * settle chase is driven by the close-confirm hold, and a resting limit close
 * simply sits.
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

/**
 * Lifecycle stages where the SDK is waiting on the **on-chain read** to confirm a
 * change it already knows is coming — an anchored open (`WRITE_ONCHAIN`) or a
 * requested close (`WRITE_ONCHAIN_CLOSE`): the notification/overlay has advanced
 * the row but `raw.onchain` has not caught up yet.
 */
const ONCHAIN_PENDING_LIFECYCLES = new Set<QuoteLifecycle>([
  QuoteLifecycle.WRITE_ONCHAIN,
  QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
]);

/**
 * Decide whether the **on-chain reads** specifically should poll at the accelerated
 * interval — the RPC-lag retry. Unlike {@link shouldAccelerateQuotePolling} (which is
 * `true` for every mid-transition stage, including the purely off-chain ones), this is
 * `true` only while a row awaits on-chain confirmation (`WRITE_ONCHAIN` /
 * `WRITE_ONCHAIN_CLOSE`). The off-chain stages (`OPTIMISTIC` / `PRICE_FILLED` /
 * `OPTIMISTIC_CLOSE` / `CLOSE_PRICE_FILLED`) have nothing on-chain to read before
 * the anchor, so they must not drive on-chain polling.
 *
 * @param result - The latest reconciliation result.
 * @returns `true` when at least one row is awaiting on-chain confirmation.
 *
 * @example
 * ```ts
 * const onchainInterval = shouldAccelerateOnchainReads(result) ? 1_500 : false;
 * ```
 */
export function shouldAccelerateOnchainReads(result: ReconcileQuotesResult): boolean {
  return result.quotes.some((quote) => ONCHAIN_PENDING_LIFECYCLES.has(quote.lifecycle));
}
