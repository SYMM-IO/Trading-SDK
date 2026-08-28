import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type {
  ListingDepositChainId,
  ListingMarketFilters,
  ListingMarketPage,
  ListingMarketSortField,
  ListingMarketStatus,
  ListingSortDirection,
} from "../types";
import { marketSearchV2MarketSearchGet } from "../types/generated/listing-backend";
import { toListingMarketPage } from "./to-listing-market";
import { toSearchParams } from "./to-search-params";

/**
 * Parameters for {@link getListingMarkets}.
 *
 * Every field is optional: with none set the service returns its default first
 * page (20 rows, newest-listed first).
 */
export type GetListingMarketsParameters = Compute<
  ChainIdParameter & {
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

/** Return type of {@link getListingMarkets}: one page of catalog rows. */
export type GetListingMarketsReturnType = ListingMarketPage;

/**
 * Fetch a page of the permissionless-listing market catalog — the data behind a
 * pools list.
 *
 * The catalog spans every listing the service knows about, at every lifecycle
 * stage; pass `marketStatus: ListingMarketStatus.LISTED` to see only tradable
 * markets. Rows come back newest-listed first unless `sortBy` is set.
 *
 * @param config - The SDK config.
 * @param parameters - Search, filter, sort, and pagination inputs.
 * @returns One page of {@link ListingMarketPage} rows plus the total row count.
 * @throws {SymmApiError} when the service request fails.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const page = await getListingMarkets(config, {
 *   marketStatus: ListingMarketStatus.LISTED,
 *   sortBy: "tvl",
 *   orderBy: "desc",
 *   limit: 50,
 * });
 * ```
 */
export async function getListingMarkets(
  config: Config,
  parameters: GetListingMarketsParameters = {},
): Promise<GetListingMarketsReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  const params = toSearchParams({
    query: parameters.search,
    chainIds: parameters.chainIds,
    marketStatus: parameters.marketStatus,
    limit: parameters.limit,
    offset: parameters.offset,
    sortBy: parameters.sortBy,
    orderBy: parameters.orderBy,
    filters: parameters.filters,
  });

  try {
    const response = await marketSearchV2MarketSearchGet(params, {
      baseURL,
      // The service expects repeated keys for array params (`chain_ids=1&chain_ids=2`).
      // Axios's default bracket form (`chain_ids[]=1`) is not rejected — it is
      // silently *ignored*, so the chain filter would drop and the caller would
      // get the whole catalog back. `indexes: null` selects the repeat form.
      paramsSerializer: { indexes: null },
    });

    return toListingMarketPage(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_LISTING_MARKETS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_LISTING_MARKETS_FAILED",
      `Failed to fetch listing markets: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
