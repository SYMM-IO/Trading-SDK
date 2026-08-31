import type { RetryListingInfo } from "../types";
import type { RetryListingInfoResponseSchema } from "../types/generated/listing-backend";

/**
 * Map the `/v2/market/retry-listing-info` response into the SDK's
 * {@link RetryListingInfo}.
 *
 * `remaining_cooldown_seconds` is optional on the wire — an absent or `null`
 * value means no cooldown is in effect, mapped to `null`.
 *
 * @param response - The raw response body.
 * @returns The normalized retry allowance.
 */
export function toRetryListingInfo(response: RetryListingInfoResponseSchema): RetryListingInfo {
  return {
    retryLimit: response.retry_limit,
    remainingRetries: response.remaining_retries,
    remainingCooldownSeconds: response.remaining_cooldown_seconds ?? null,
  };
}
