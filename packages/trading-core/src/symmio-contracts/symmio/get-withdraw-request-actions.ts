import { isAddressEqual, zeroAddress } from "viem";
import { WithdrawStatus, type WithdrawRequest } from "./types";

/**
 * Which writes SYMMIO Core's status rules allow on a withdraw request, as
 * returned by {@link getWithdrawRequestActions}. Both flags are time-free.
 */
export interface WithdrawRequestActions {
  /**
   * Whether `finalizeWithdrawRequest` accepts the request's status. The call
   * still reverts until `block.timestamp` reaches the request's `cooldownEndTime`.
   */
  finalize: boolean;
  /** Whether the owner's `requestCancelWithdraw` accepts the request's status. */
  cancel: boolean;
}

/**
 * Decide which writes SYMMIO Core accepts on a withdraw request, from its
 * `provider` and `status` alone.
 *
 * Mirrors the status checks of `finalizeWithdrawRequest` and
 * `requestCancelWithdraw` in `WithdrawFacetImpl.sol` (perps-core v0.8.6), so a
 * UI can render every request from {@link getPendingWithdrawRequests} and offer
 * only the actions whose status check passes:
 *
 * | Request                                                    | `finalize` | `cancel` |
 * | ---------------------------------------------------------- | ---------- | -------- |
 * | classic (`provider` is the zero address), `PENDING`        | yes        | yes      |
 * | provider-backed, `PENDING`                                 | no         | yes      |
 * | provider-backed, `PROVIDER_ACCEPTED`                       | yes        | yes      |
 * | provider-backed, `CANCEL_REQUESTED`                        | yes        | no       |
 * | `SUSPENDED`, `COMPLETED`, `CANCELLED`, `PROVIDER_REJECTED` | no         | no       |
 *
 * A classic request only moves from `PENDING` to `COMPLETED`, `CANCELLED`, or
 * `SUSPENDED`; the provider statuses belong to Express and virtual-provider
 * requests. `SUSPENDED` still appears among the pending requests, but Core
 * refunded it on suspension, so no action is left.
 *
 * The result is a status check, not a promise that the write succeeds:
 *
 * - **Cooldown.** `finalize` still reverts until `block.timestamp >=
 *   cooldownEndTime`. Show Finalize disabled with a countdown until then, and
 *   judge it against chain time rather than the browser clock.
 * - **Finalize is permissionless**, so any wallet may send it. It pays each
 *   classic part to the receiver baked into it, but on an Express request it
 *   releases the express parts' remaining (not yet advanced) amount to the
 *   **provider**, not the receiver. The provider's service normally drives that
 *   step.
 * - **Cancel is owner-only.** Core looks the request up under the calling
 *   account, so {@link requestCancelWithdraw} routes it through the AccountLayer
 *   `_call` proxy as the subaccount. An Express request also needs the provider
 *   to approve the cancel (see `isExpressWithdrawCancellable`).
 * - **A valid status can still revert.** Both writes revert while the request's
 *   subaccount is suspended, or when a provider callback rejects the
 *   transition. Finalize also reverts while Core is globally or
 *   accounting-paused. Cancel on a pure-virtual request also reverts once fewer
 *   than Core's `pureVirtualCancelBlackout` seconds remain before
 *   `cooldownEndTime`, or after it. The SDK write actions simulate first by
 *   default (`simulateBeforeWrite`), so on the wallet path these reverts surface
 *   before the wallet prompt.
 *
 * @param request - The request's `provider` and `status`, e.g. a {@link WithdrawRequest}.
 * @returns Whether Core's status rules allow `finalize` and `cancel` on the request.
 *
 * @example
 * ```ts
 * const requests = await getPendingWithdrawRequests(config, { user: "0xsub…" });
 * const { timestamp } = await config.getClient().getBlock();
 *
 * for (const request of requests) {
 *   const actions = getWithdrawRequestActions(request);
 *   const canFinalizeNow = actions.finalize && timestamp >= request.cooldownEndTime;
 *   const canCancel = actions.cancel;
 * }
 * ```
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/core/facets/Withdraw/WithdrawFacetImpl.sol}
 */
export function getWithdrawRequestActions(
  request: Pick<WithdrawRequest, "provider" | "status">,
): WithdrawRequestActions {
  const { provider, status } = request;
  const finalize = isAddressEqual(provider, zeroAddress)
    ? status === WithdrawStatus.PENDING
    : status === WithdrawStatus.PROVIDER_ACCEPTED || status === WithdrawStatus.CANCEL_REQUESTED;
  const cancel = status === WithdrawStatus.PENDING || status === WithdrawStatus.PROVIDER_ACCEPTED;

  return { finalize, cancel };
}
