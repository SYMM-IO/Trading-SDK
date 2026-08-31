import type { RetryListingResult } from "../types";
import type { RetryListingResponseSchema } from "../types/generated/listing-backend";

/**
 * Map the `/v2/market/retry-listing` response into the SDK's
 * {@link RetryListingResult}.
 *
 * @param response - The raw response body.
 * @returns The normalized retry result.
 */
export function toRetryListingResult(response: RetryListingResponseSchema): RetryListingResult {
  return {
    retryLimit: response.retry_limit,
    remainingRetries: response.remaining_retries,
    cooldownSeconds: response.cooldown_seconds,
  };
}
