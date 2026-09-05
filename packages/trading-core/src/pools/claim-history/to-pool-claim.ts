import { parseListingValue } from "../markets/to-listing-market";
import type { PoolClaim, PoolClaimHistoryPage } from "../types";
import type { GetClaimResponseSchema, SearchClaimsResponseSchema } from "../types/generated/listing-backend";

/**
 * Map one raw claim record into the SDK's {@link PoolClaim}.
 *
 * `amount` is the claimed USDC in **plain decimal units** (`"0.0377"`), the same
 * form as `claimable_reward` on `/v2/profit` — it is scaled up with
 * {@link parseListingValue} to the SDK's uniform 18-decimal `bigint`. The wire's
 * internal `wallet_id` / `market_id` UUIDs are dropped; they address rows in the
 * service, not anything a consumer renders.
 *
 * @param raw - One claim record from the search response.
 * @returns The normalized claim.
 */
export function toPoolClaim(raw: GetClaimResponseSchema): PoolClaim {
  return {
    claimRequestId: raw.claim_request_id,
    accountAddress: raw.account_address,
    amount: parseListingValue(raw.amount) ?? 0n,
    transactionHash: raw.transaction_hash ?? null,
    time: raw.create_time,
  };
}

/**
 * Map the `/v2/claim/search` envelope into a {@link PoolClaimHistoryPage}.
 *
 * @param raw - The response body.
 * @returns The normalized page. `count` is the total across all pages.
 */
export function toPoolClaimHistoryPage(raw: SearchClaimsResponseSchema): PoolClaimHistoryPage {
  return {
    count: raw.total,
    items: (raw.data ?? []).map(toPoolClaim),
  };
}
