import type { WeeklyListingLimit } from "../types";
import type { WeeklyListingLimitResponse } from "../types/generated/listing-backend";

/**
 * Map the raw `WeeklyListingLimitResponse` from the listing service into the
 * SDK's {@link WeeklyListingLimit}.
 *
 * The only reshape is renaming the wire's snake_case `reset_at` to the SDK's
 * camelCase `resetAt`; `limit` and `remaining` pass through unchanged.
 *
 * @param raw - The endpoint's `/v2/market/weekly-listing-limit` response body.
 * @returns The normalized weekly listing limit.
 */
export function toWeeklyListingLimit(raw: WeeklyListingLimitResponse): WeeklyListingLimit {
  return {
    limit: raw.limit,
    remaining: raw.remaining,
    resetAt: raw.reset_at,
  };
}
