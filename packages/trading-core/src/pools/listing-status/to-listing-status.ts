import type { ListingMarketStatus, ListingStatus } from "../types";
import type { MarketListingStatusResponse } from "../types/generated/listing-backend";

/**
 * Map the raw `/v2/market/listing-status` response into the SDK's
 * {@link ListingStatus}.
 *
 * Renames the snake_case wire fields to camelCase. `market_status` is a string on
 * the wire carrying the same values as {@link ListingMarketStatus}, so the cast is
 * value-preserving (a consumer should still fall back to the raw string for any
 * pipeline-only value). Absent optionals collapse: `current_step` and the `error_*`
 * fields to `null`, `retry_count` / `retry_limit` to `0`.
 *
 * @param raw - The endpoint's `/v2/market/listing-status` response body.
 * @returns The normalized listing status.
 */
export function toListingStatus(raw: MarketListingStatusResponse): ListingStatus {
  return {
    marketStatus: raw.market_status as unknown as ListingMarketStatus,
    currentStep: raw.current_step ?? null,
    steps: raw.steps ?? [],
    errorCode: raw.error_code ?? null,
    errorDetail: raw.error_detail ?? null,
    retryCount: raw.retry_count ?? 0,
    retryLimit: raw.retry_limit ?? 0,
  };
}
