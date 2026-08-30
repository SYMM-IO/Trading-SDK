import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { PoolCancelWithdrawResult } from "../types";
import { cancelWithdrawV2MarketWithdrawWithdrawIdDelete } from "../types/generated/listing-backend";
import { toCancelWithdrawResult } from "./to-cancel-withdraw-result";

/**
 * Parameters for {@link cancelWithdraw}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. The endpoint is authed and scoped to the
 * caller — a user may only cancel their own queued withdrawal.
 */
export type CancelWithdrawParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /**
     * Id of the queued withdrawal to cancel — the `transactionId` of the pending
     * `withdraw` row from the pool's transaction history (`getPoolTransactions`),
     * whose `status` is still `PENDING`.
     */
    withdrawId: string;
  }
>;

/**
 * Return type of {@link cancelWithdraw}: the cancellation receipt — the affected
 * transaction id and its resulting status.
 */
export type CancelWithdrawReturnType = PoolCancelWithdrawResult;

/**
 * Cancel a queued LP withdrawal — remove a pending withdrawal from the pool's
 * withdrawal queue before it settles.
 *
 * `DELETE`s `/v2/market/withdraw/{withdrawId}` with the caller's bearer token.
 * The `withdrawId` is the `transactionId` of a still-`PENDING` `withdraw` row
 * from {@link getPoolTransactions}. On success the shares return to the user's
 * available balance, so refetch {@link getUserProfit} to see `availableLpAmount`
 * rise and `pendingWithdrawLpAmount` fall. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token and the queued withdrawal's id.
 * @returns The cancellation receipt: the transaction id and its resulting status.
 * @throws {SymmApiError} `CANCEL_WITHDRAW_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, a `404` for an unknown id, and the service's rejection when the withdrawal has already settled (no longer cancelable), which surface with the service's message and status as-is.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the cancel action instead.
 *
 * @example
 * ```ts
 * const receipt = await cancelWithdraw(config, {
 *   accessToken: token.accessToken,
 *   withdrawId: pendingWithdrawal.transactionId,
 * });
 * ```
 */
export async function cancelWithdraw(
  config: Config,
  parameters: CancelWithdrawParameters,
): Promise<CancelWithdrawReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await cancelWithdrawV2MarketWithdrawWithdrawIdDelete(parameters.withdrawId, {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return toCancelWithdrawResult(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "CANCEL_WITHDRAW_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "CANCEL_WITHDRAW_FAILED",
      `Failed to cancel withdrawal: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
