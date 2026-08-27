import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { toSearchParams } from "../markets/to-search-params";
import { resolveListingService } from "../resolve-listing";
import type {
  ListingDepositChainId,
  ListingMarketFilters,
  ListingMarketSortField,
  ListingMarketStatus,
  ListingSortDirection,
  UserListingMarketPage,
} from "../types";
import {
  marketUserSearchV2MarketSearchUserGet,
  type MarketUserSearchV2MarketSearchUserGetParams,
} from "../types/generated/listing-backend";
import { toUserListingMarketPage } from "./to-user-listing-market";

/**
 * Parameters for {@link getUserListingMarkets}.
 *
 * `accessToken` is required — the endpoint is authed. Every other field is
 * optional and shares the semantics of the public {@link getListingMarkets}
 * search: with none set the service returns its default first page.
 */
export type GetUserListingMarketsParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /**
     * Free-text search, matched against contract address, ticker, and token
     * name.
     *
     * Named `search` rather than `query` because the TanStack options bag on the
     * matching query factory already owns `query`.
     */
    search?: string;
    /**
     * Restrict to tokens deposited on these chains. An empty array is sent as
     * no filter, matching the service's behavior for an absent param.
     */
    chainIds?: readonly ListingDepositChainId[];
    /** Restrict to one lifecycle status. */
    marketStatus?: ListingMarketStatus;
    /** Page size, `1`–`100`. Service default `20`. */
    limit?: number;
    /** Row offset. Service default `0`. */
    offset?: number;
    /** Server-side sort key. */
    sortBy?: ListingMarketSortField;
    /** Sort direction. Service default `"desc"`. */
    orderBy?: ListingSortDirection;
    /** Inclusive numeric range filters. */
    filters?: ListingMarketFilters;
  }
>;

/** Return type of {@link getUserListingMarkets}: one page of the signed-in user's pool rows. */
export type GetUserListingMarketsReturnType = UserListingMarketPage;

/**
 * Fetch a page of "Your Pools" — the markets that generated a deposit address for
 * the signed-in user, whether or not they have deposited into them yet.
 *
 * This is the authed twin of {@link getListingMarkets}: it hits
 * `/v2/market/search-user` with the caller's bearer token and returns the same
 * catalog rows enriched with the user's `userDeposit`, `userSharePercentage`, and
 * `userRevenue`. Search, filter, sort, and pagination all behave identically to
 * the public catalog. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token plus search, filter, sort, and pagination inputs.
 * @returns One page of {@link UserListingMarketPage} rows plus the total row count.
 * @throws {SymmApiError} when the endpoint request fails, including a `401` on a bad or expired token.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const page = await getUserListingMarkets(config, {
 *   accessToken: token.accessToken,
 *   sortBy: "tvl",
 *   orderBy: "desc",
 *   limit: 50,
 * });
 * ```
 */
export async function getUserListingMarkets(
  config: Config,
  parameters: GetUserListingMarketsParameters,
): Promise<GetUserListingMarketsReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  // `toSearchParams` types its output as the *public* endpoint's params. The
  // authed endpoint's params are structurally the same except its `sort_by` enum
  // drops `reward_24h` and adds the user-scoped keys, so the two nominal types do
  // not assign. The values built here are plain strings from `ListingMarketSortField`
  // — the SDK's real sort contract — so the cast is safe; it only re-labels the
  // generated param type at this one internal boundary.
  const params = toSearchParams({
    query: parameters.search,
    chainIds: parameters.chainIds,
    marketStatus: parameters.marketStatus,
    limit: parameters.limit,
    offset: parameters.offset,
    sortBy: parameters.sortBy,
    orderBy: parameters.orderBy,
    filters: parameters.filters,
  }) as unknown as MarketUserSearchV2MarketSearchUserGetParams;

  try {
    const response = await marketUserSearchV2MarketSearchUserGet(params, {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
      // The service expects repeated keys for array params (`chain_ids=1&chain_ids=2`).
      // Axios's default bracket form (`chain_ids[]=1`) is not rejected — it is
      // silently *ignored*, so the chain filter would drop and the caller would
      // get the whole catalog back. `indexes: null` selects the repeat form.
      paramsSerializer: { indexes: null },
    });

    return toUserListingMarketPage(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_USER_LISTING_MARKETS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_USER_LISTING_MARKETS_FAILED",
      `Failed to fetch your listing markets: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
