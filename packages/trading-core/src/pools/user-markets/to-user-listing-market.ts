import { toListingMarket, toListingValue } from "../markets/to-listing-market";
import type { UserListingMarket, UserListingMarketPage } from "../types";
import type {
  MarketSearchItem,
  PaginationResponseUserMarketSearchItem,
  UserMarketSearchItem,
} from "../types/generated/listing-backend";

/**
 * Map one raw `UserMarketSearchItem` from the authed listing endpoint into the
 * SDK's {@link UserListingMarket}.
 *
 * A user row is the public market row plus three user-scoped fields, so this
 * reuses {@link toListingMarket} for the shared base and appends the extras.
 * The `as unknown as MarketSearchItem` cast is safe and intentional: every field
 * the base mapper reads exists on the user row with the same wire name and type,
 * with one wrinkle — the user row omits `reward_24h`, which the base mapper reads
 * through {@link toListingValue}, so it normalizes to `null` (absent, not zero),
 * exactly as it should. `userDeposit` and `userRevenue` go through the same
 * 18-decimal parser and stay `null` when absent; `userSharePercentage` is a plain
 * percentage number the service always sends.
 *
 * @param raw - One row of the endpoint's `/v2/market/search-user` response.
 * @returns The normalized user market.
 */
export function toUserListingMarket(raw: UserMarketSearchItem): UserListingMarket {
  return {
    ...toListingMarket(raw as unknown as MarketSearchItem),
    userDeposit: toListingValue(raw.user_deposit),
    userSharePercentage: raw.user_share_percentage,
    userRevenue: toListingValue(raw.user_revenue),
  };
}

/**
 * Map the endpoint's paginated envelope into a {@link UserListingMarketPage}.
 *
 * The generated schema marks every envelope field optional (the service declares
 * defaults rather than requiring them), so each is defaulted here: counts to `0`
 * and `items` to an empty array.
 *
 * @param raw - The endpoint's `/v2/market/search-user` response body.
 * @returns The normalized page.
 */
export function toUserListingMarketPage(raw: PaginationResponseUserMarketSearchItem): UserListingMarketPage {
  return {
    total: raw.total ?? 0,
    limit: raw.limit ?? 0,
    offset: raw.offset ?? 0,
    items: (raw.items ?? []).map(toUserListingMarket),
  };
}
