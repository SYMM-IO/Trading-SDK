import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import {
  ListingDepositChainId,
  ListingMarketStatus,
  type ListingMarketFilters,
  type ListingMarketSortField,
} from "../types";

/**
 * Exhaustive coverage of every **sorting** and **filtering** input
 * `getUserListingMarkets` accepts, asserted at the wire boundary: each SDK-shaped
 * param must reach the generated `/v2/market/search-user` client as the exact
 * query key the service expects. A silent mismatch here is invisible in
 * production — the service ignores unknown query params and returns the
 * unfiltered/unsorted result — so it is pinned here instead.
 */

const marketUserSearch = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return { ...actual, marketUserSearchV2MarketSearchUserGet: marketUserSearch };
});

import { getUserListingMarkets, type GetUserListingMarketsParameters } from "./get-user-listing-markets";

const { config } = mockConfig();

/** Every `sortBy` literal the SDK exposes (the service's own wire keys, sent verbatim). */
const SORT_FIELDS: readonly ListingMarketSortField[] = [
  "liquidity",
  "tvl",
  "market_cap",
  "vol24h",
  "open_interest",
  "apr_1h",
  "apr_6h",
  "apr_24h",
  "apr_30d",
  "reward_24h",
  "apr",
  "tvl_driven_apy_1h",
  "tvl_driven_apy_6h",
  "tvl_driven_apy_24h",
  "tvl_driven_apy_30d",
  "tvl_driven_apy",
  "price_driven_apy_1h",
  "price_driven_apy_6h",
  "price_driven_apy_24h",
  "price_driven_apy_30d",
  "price_driven_apy",
  "listing_time",
];

/**
 * Every **value** filter key (18-decimal bigint bounds) mapped to the wire field
 * its `__ge` / `__le` bounds attach to. `listingTime` is covered separately
 * because its bounds are Unix-second numbers, not 18-decimal bigints.
 */
const VALUE_FILTER_WIRE = {
  marketCap: "market_cap",
  vol24h: "vol24h",
  tvl: "tvl",
  liquidity: "liquidity",
  openInterest: "open_interest",
  reward24h: "reward_24h",
  apr: "apr",
  apr1h: "apr_1h",
  apr6h: "apr_6h",
  apr24h: "apr_24h",
  apr30d: "apr_30d",
  tvlDrivenApy1h: "tvl_driven_apy_1h",
  tvlDrivenApy6h: "tvl_driven_apy_6h",
  tvlDrivenApy24h: "tvl_driven_apy_24h",
  tvlDrivenApy30d: "tvl_driven_apy_30d",
  tvlDrivenApy: "tvl_driven_apy",
  priceDrivenApy1h: "price_driven_apy_1h",
  priceDrivenApy6h: "price_driven_apy_6h",
  priceDrivenApy24h: "price_driven_apy_24h",
  priceDrivenApy30d: "price_driven_apy_30d",
  priceDrivenApy: "price_driven_apy",
} as const satisfies Partial<Record<keyof ListingMarketFilters, string>>;

const VALUE_FILTER_ENTRIES = Object.entries(VALUE_FILTER_WIRE) as [keyof ListingMarketFilters, string][];

const WEI = 10n ** 18n;

beforeEach(() => {
  marketUserSearch.mockReset();
  marketUserSearch.mockResolvedValue({ data: { total: 0, limit: 20, offset: 0, items: [] } });
});

/** Run the action with `accessToken` pre-filled and return the wire params it sent. */
async function paramsFor(
  overrides: Omit<GetUserListingMarketsParameters, "accessToken">,
): Promise<Record<string, unknown>> {
  await getUserListingMarkets(config, { accessToken: "tok", ...overrides });
  return marketUserSearch.mock.calls[0]![0] as Record<string, unknown>;
}

/** Build a `ListingMarketFilters` with one value-filter key set (the computed key needs a cast). */
function valueFilter(key: keyof ListingMarketFilters, range: { min?: bigint; max?: bigint }): ListingMarketFilters {
  return { [key]: range } as ListingMarketFilters;
}

describe("getUserListingMarkets — sorting params", () => {
  it.each(SORT_FIELDS)("forwards sortBy=%s to sort_by verbatim", async (sortBy) => {
    const params = await paramsFor({ sortBy });
    expect(params.sort_by).toBe(sortBy);
  });

  it.each(["asc", "desc"] as const)("forwards orderBy=%s to order_by", async (orderBy) => {
    const params = await paramsFor({ orderBy });
    expect(params.order_by).toBe(orderBy);
  });

  it("sends sort_by and order_by together", async () => {
    const params = await paramsFor({ sortBy: "tvl", orderBy: "asc" });
    expect(params).toMatchObject({ sort_by: "tvl", order_by: "asc" });
  });

  it("omits sort_by / order_by when neither is set (service applies its own default)", async () => {
    const params = await paramsFor({});
    expect(params.sort_by).toBeUndefined();
    expect(params.order_by).toBeUndefined();
  });
});

describe("getUserListingMarkets — value filters (18-decimal bounds)", () => {
  it.each(VALUE_FILTER_ENTRIES)("maps filters.%s { min, max } to %s__ge / __le (stringified)", async (key, wire) => {
    const min = 1_000n * WEI;
    const max = 5_000n * WEI;
    const params = await paramsFor({ filters: valueFilter(key, { min, max }) });
    expect(params[`${wire}__ge`]).toBe(String(min));
    expect(params[`${wire}__le`]).toBe(String(max));
  });

  it.each(VALUE_FILTER_ENTRIES)("sends only %s__ge for a min-only %s bound", async (key, wire) => {
    const min = 42n * WEI;
    const params = await paramsFor({ filters: valueFilter(key, { min }) });
    expect(params[`${wire}__ge`]).toBe(String(min));
    expect(params[`${wire}__le`]).toBeUndefined();
  });

  it.each(VALUE_FILTER_ENTRIES)("sends only %s__le for a max-only %s bound", async (key, wire) => {
    const max = 99n * WEI;
    const params = await paramsFor({ filters: valueFilter(key, { max }) });
    expect(params[`${wire}__le`]).toBe(String(max));
    expect(params[`${wire}__ge`]).toBeUndefined();
  });
});

describe("getUserListingMarkets — listingTime filter (Unix seconds)", () => {
  it("maps listingTime { min, max } to listing_time__ge / __le", async () => {
    const params = await paramsFor({ filters: { listingTime: { min: 1_700_000_000, max: 1_800_000_000 } } });
    expect(params.listing_time__ge).toBe("1700000000");
    expect(params.listing_time__le).toBe("1800000000");
  });

  it("sends only listing_time__ge for a min-only bound", async () => {
    const params = await paramsFor({ filters: { listingTime: { min: 1_700_000_000 } } });
    expect(params.listing_time__ge).toBe("1700000000");
    expect(params.listing_time__le).toBeUndefined();
  });
});

describe("getUserListingMarkets — combined and omitted filters", () => {
  it("flattens several filters into one param bag", async () => {
    const params = await paramsFor({
      filters: { tvl: { min: 1n }, apr: { max: 5n }, listingTime: { min: 1_700_000_000 } },
    });
    expect(params).toMatchObject({ tvl__ge: "1", apr__le: "5", listing_time__ge: "1700000000" });
  });

  it("omits every filter param when filters is undefined", async () => {
    const params = await paramsFor({});
    for (const wire of Object.values(VALUE_FILTER_WIRE)) {
      expect(params[`${wire}__ge`]).toBeUndefined();
      expect(params[`${wire}__le`]).toBeUndefined();
    }
    expect(params.listing_time__ge).toBeUndefined();
    expect(params.listing_time__le).toBeUndefined();
  });
});

describe("getUserListingMarkets — search, status, chains, pagination", () => {
  it("maps search → query, chainIds → chain_ids, marketStatus → market_status, limit, offset", async () => {
    const params = await paramsFor({
      search: "btc",
      chainIds: [ListingDepositChainId.BSC, ListingDepositChainId.BASE],
      marketStatus: ListingMarketStatus.LISTED,
      limit: 50,
      offset: 100,
    });
    expect(params).toMatchObject({
      query: "btc",
      chain_ids: [ListingDepositChainId.BSC, ListingDepositChainId.BASE],
      market_status: ListingMarketStatus.LISTED,
      limit: 50,
      offset: 100,
    });
  });

  it("sends an empty param bag when only accessToken is supplied", async () => {
    const params = await paramsFor({});
    expect(params).toEqual({});
  });
});

describe("getUserListingMarkets — auth", () => {
  it("attaches the bearer access token as an Authorization header", async () => {
    await getUserListingMarkets(config, { accessToken: "secret-token", sortBy: "tvl" });
    const options = marketUserSearch.mock.calls[0]![1] as { headers?: Record<string, string> };
    expect(options.headers?.Authorization).toBe("Bearer secret-token");
  });

  it("keeps the access token out of the query params it forwards", async () => {
    const params = await paramsFor({ sortBy: "tvl" });
    expect(params.accessToken).toBeUndefined();
    expect(params.access_token).toBeUndefined();
  });
});
