import type { ExpressWithdrawStatus } from "./types";

/**
 * Test whether the Express provider still accepts a user cancel for a request.
 *
 * Core's `requestCancelWithdraw` hands an accepted Express request to the
 * provider's `onWithdrawCancelRequest` callback, which only approves from the
 * provider's `ACCEPTED` status and otherwise reverts the whole cancel:
 *
 * - `SAME_TX` is paid in the initiating transaction and skips `ACCEPTED`, so it
 *   is never cancellable.
 * - `WINDOWED` and `STANDARD` are cancellable only while the provider status is
 *   `ACCEPTED`. Once it is `LOCKED`, `PROCESSED`, or `FINALIZED` the callback
 *   reverts, and terminal statuses leave nothing to cancel.
 *
 * This is the provider's half of the rule. Combine it with
 * `getWithdrawRequestActions(request).cancel`, which applies Core's own status
 * check to the on-chain request.
 *
 * @param status - Combined service/on-chain status.
 * @returns Whether the provider would approve a cancel now.
 *
 * @example
 * ```ts
 * const canCancel = getWithdrawRequestActions(request).cancel && isExpressWithdrawCancellable(status);
 * ```
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/expressWithdrawLayer/facets/SymmioHook/SymmioHookFacet.sol}
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/docs/v0.8.6/pages/express-withdrawal-system-design.html} §6.3 Cancellation and §15.1 Cancellation rules.
 */
export function isExpressWithdrawCancellable(status: ExpressWithdrawStatus): boolean {
  return status.onChain.status === "ACCEPTED";
}
