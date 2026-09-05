import type { ListingMarketFilters, ListingTimeRange, ListingValueRange } from "../types";
import type { MarketSearchV2MarketSearchGetParams } from "../types/generated/listing-backend";

/**
 * SDK filter key to the wire field its `__ge` / `__le` bounds attach to.
 *
 * Kept as an explicit table rather than derived from the key name: several
 * fields do not round-trip through a naive camel-to-snake conversion
 * (`vol24h`, `apr24h` → `apr_24h`, `tvlDrivenApy` → `tvl_driven_apy`), and a
 * silent mismatch here is invisible — the service ignores unknown query params
 * and returns the unfiltered catalog.
 */
const FILTER_WIRE_FIELD = {
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
  listingTime: "listing_time",
} as const satisfies Record<keyof ListingMarketFilters, string>;

/**
 * Flatten {@link ListingMarketFilters} into the service's `{field}__ge` /
 * `{field}__le` query params.
 *
 * `bigint` bounds are stringified rather than passed through: an 18-decimal
 * value exceeds `Number.MAX_SAFE_INTEGER`, so serializing it as a number would
 * round the bound. The service accepts the string form.
 *
 * @param filters - The SDK-shaped filters, or `undefined` for none.
 * @returns A flat bag of wire params; empty when nothing is filtered.
 */
export function toFilterParams(filters?: ListingMarketFilters): Record<string, string> {
  if (filters === undefined) return {};

  const params: Record<string, string> = {};

  for (const [key, wireField] of Object.entries(FILTER_WIRE_FIELD)) {
    const range = filters[key as keyof ListingMarketFilters] as ListingValueRange | ListingTimeRange | undefined;
    if (range === undefined) continue;

    if (range.min !== undefined) params[`${wireField}__ge`] = String(range.min);
    if (range.max !== undefined) params[`${wireField}__le`] = String(range.max);
  }

  return params;
}

/** Non-filter query inputs {@link toSearchParams} accepts. */
export interface ToSearchParamsInput {
  query?: string;
  chainIds?: readonly number[];
  marketStatus?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  orderBy?: "asc" | "desc";
  filters?: ListingMarketFilters;
}

/**
 * Build the full `/v2/market/search` query bag from SDK-shaped inputs.
 *
 * Undefined inputs are omitted entirely rather than sent as empty values, so the
 * service applies its own defaults (`limit=20`, `offset=0`, `order_by=desc`).
 *
 * @param input - SDK-shaped search inputs.
 * @returns The wire query params.
 */
export function toSearchParams(input: ToSearchParamsInput): MarketSearchV2MarketSearchGetParams {
  const params: Record<string, unknown> = { ...toFilterParams(input.filters) };

  if (input.query !== undefined) params.query = input.query;
  if (input.chainIds !== undefined) params.chain_ids = [...input.chainIds];
  if (input.marketStatus !== undefined) params.market_status = input.marketStatus;
  if (input.limit !== undefined) params.limit = input.limit;
  if (input.offset !== undefined) params.offset = input.offset;
  if (input.sortBy !== undefined) params.sort_by = input.sortBy;
  if (input.orderBy !== undefined) params.order_by = input.orderBy;

  return params as MarketSearchV2MarketSearchGetParams;
}
