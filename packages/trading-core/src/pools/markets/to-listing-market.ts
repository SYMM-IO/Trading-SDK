import {
  ListingDepositChainId,
  ListingMarketStatus,
  type ListingApyWindows,
  type ListingMarket,
  type ListingMarketPage,
  type ListingTrailingWindows,
} from "../types";
import type { MarketSearchItem, PaginationResponseMarketSearchItem } from "../types/generated/listing-backend";

/**
 * Parse one of the service's 18-decimal value strings into a `bigint`.
 *
 * Returns `null` for `null`, `undefined`, and the empty string — an absent
 * figure is not zero, and collapsing the two would make a market with no 30-day
 * history indistinguishable from one that earned nothing.
 *
 * The service's own schema types these as unsigned decimal strings, but live
 * responses carry negative APY values, and a fractional string would make
 * `BigInt()` throw. Both are handled: a leading `-` is preserved and any
 * fractional tail is truncated toward zero.
 */
export function toListingValue(raw: string | null | undefined): bigint | null {
  if (raw === null || raw === undefined) return null;

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const match = /^([+-]?)(\d*)(?:\.\d*)?$/.exec(trimmed);
  if (match === null) return null;

  const digits = match[2];
  if (digits === undefined || digits === "") return null;

  const magnitude = BigInt(digits);
  return match[1] === "-" ? -magnitude : magnitude;
}

/**
 * Map the four trailing windows of a metric whose wire keys share `prefix`.
 *
 * @param raw - The response row.
 * @param prefix - Wire key prefix, e.g. `"apr"` for `apr_1h` … `apr_30d`.
 */
function toTrailingWindows(raw: MarketSearchItem, prefix: string): ListingTrailingWindows {
  const row = raw as unknown as Record<string, string | null | undefined>;
  return {
    h1: toListingValue(row[`${prefix}_1h`]),
    h6: toListingValue(row[`${prefix}_6h`]),
    h24: toListingValue(row[`${prefix}_24h`]),
    d30: toListingValue(row[`${prefix}_30d`]),
  };
}

/** Map the trailing windows plus the lifetime column of an APY series. */
function toApyWindows(raw: MarketSearchItem, prefix: string): ListingApyWindows {
  const row = raw as unknown as Record<string, string | null | undefined>;
  return {
    ...toTrailingWindows(raw, prefix),
    lifetime: toListingValue(row[`${prefix}_lifetime`]),
  };
}

/**
 * Map one raw `MarketSearchItem` from the listing service into the SDK's
 * {@link ListingMarket}.
 *
 * Value fields become `bigint` at {@link ListingMarket} scale, absent figures
 * stay `null`, and the wire's snake_case becomes the SDK's camelCase.
 *
 * @param raw - One row of the service's `/v2/market/search` response.
 * @returns The normalized market.
 */
export function toListingMarket(raw: MarketSearchItem): ListingMarket {
  return {
    contractAddress: raw.contract_address,
    chainId: raw.chain_id as ListingDepositChainId,
    symbolId: raw.symbol_id ?? null,
    tokenTicker: raw.token_ticker,
    tokenName: raw.token_name,
    maxLeverage: raw.max_leverage,
    marketCap: toListingValue(raw.market_cap),
    vol24h: toListingValue(raw.vol24h),
    tvl: toListingValue(raw.tvl),
    liquidity: toListingValue(raw.liquidity),
    openInterest: toListingValue(raw.open_interest),
    reward24h: toListingValue(raw.reward_24h),
    apr: toListingValue(raw.apr),
    aprByWindow: toTrailingWindows(raw, "apr"),
    tvlDrivenApy: toApyWindows(raw, "tvl_driven_apy"),
    priceDrivenApy: toApyWindows(raw, "price_driven_apy"),
    listingTime: raw.listing_time ?? null,
    marketStatus: raw.market_status as unknown as ListingMarketStatus,
  };
}

/**
 * Map the service's paginated envelope into a {@link ListingMarketPage}.
 *
 * The generated schema marks every envelope field optional (the service declares
 * defaults rather than requiring them), so each is defaulted here: counts to `0`
 * and `items` to an empty array.
 *
 * @param raw - The service's `/v2/market/search` response body.
 * @returns The normalized page.
 */
export function toListingMarketPage(raw: PaginationResponseMarketSearchItem): ListingMarketPage {
  return {
    total: raw.total ?? 0,
    limit: raw.limit ?? 0,
    offset: raw.offset ?? 0,
    items: (raw.items ?? []).map(toListingMarket),
  };
}
