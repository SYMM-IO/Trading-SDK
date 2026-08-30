import { parseListingValue } from "../markets/to-listing-market";
import type { PoolClaimResult } from "../types";
import type { ClaimProfitResponseSchema } from "../types/generated/listing-backend";

/**
 * Map the `/v2/claim` response into the SDK's {@link PoolClaimResult}.
 *
 * `amount` echoes the claimed reward, which the listing service reports in
 * **plain decimal units** (`"0.0377"` = `$0.0377`) — the same form as
 * `claimable_reward` on `/v2/profit`, not the 1e18-scaled integer most fields
 * use. It is scaled up with {@link parseListingValue} to the SDK's uniform
 * 18-decimal `bigint` (absent → `0n`). `transaction_hash` is optional on the
 * wire — a pending or hash-less claim yields `null`, never `undefined`.
 *
 * @param response - The raw `claimProfitV2ClaimPost` response body.
 * @returns The normalized claim receipt.
 */
export function toClaimResult(response: ClaimProfitResponseSchema): PoolClaimResult {
  return {
    status: response.status,
    amountClaimed: parseListingValue(response.amount) ?? 0n,
    claimRequestId: response.claim_request_id,
    transactionHash: response.transaction_hash ?? null,
  };
}
