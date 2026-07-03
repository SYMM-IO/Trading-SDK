import type { UnifiedQuote } from "./unified-quote";

/**
 * Compute a content fingerprint for a {@link UnifiedQuote}, independent of its
 * id/origin.
 *
 * The fingerprint combines the fields that uniquely identify a trade's economic
 * intent — `orderType`, `positionType`, the locked `cva` / `lf`, `quantity`, and
 * `requestedOpenPrice`. Reconciliation uses it to recognize that an off-chain
 * (optimistic) row and a freshly-landed on-chain row are the same trade, so the
 * off-chain duplicate can be dropped once the on-chain quote appears.
 *
 * @param q - The unified row to fingerprint.
 * @returns A stable string identical for the off-chain and on-chain views of one trade.
 *
 * @example
 * ```ts
 * if (fingerprintQuote(optimistic) === fingerprintQuote(onchain)) {
 *   // same trade — drop the optimistic row
 * }
 * ```
 */
export function fingerprintQuote(q: UnifiedQuote): string {
  return [q.orderType, q.positionType, q.lockedValues.cva, q.lockedValues.lf, q.quantity, q.requestedOpenPrice].join(
    ":",
  );
}
