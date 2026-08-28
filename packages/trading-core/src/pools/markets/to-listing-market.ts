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
 * The service's own schema types these as plain unsigned decimal strings, but
 * live responses are looser than that in three ways, all handled here:
 *
 * - **Signs.** APY and uPnL fields go negative; a leading `-` is preserved.
 * - **Fractional tails.** `long_position_upnl` arrives as
 *   `"22411664984426494286154.904298"`, which `BigInt()` would reject. The
 *   fraction is truncated toward zero.
 * - **Scientific notation.** uPnL fields also arrive as `"0E-36"` (a Python
 *   `Decimal` serialization). Every live instance is zero today, so a parser
 *   that rejected the form would still *look* correct — but a tiny non-zero
 *   uPnL would then silently read as `0`. The exponent is applied instead.
 */
export function toListingValue(raw: string | null | undefined): bigint | null {
  if (raw === null || raw === undefined) return null;

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(trimmed);
  if (match === null) return null;

  const [, sign = "", intPart = "", fracPart = "", exponentPart] = match;
  if (intPart === "" && fracPart === "") return null;

  /**
   * Shift the decimal point by the exponent, then truncate. Working on the digit
   * string rather than via `10n ** exponent` keeps a large negative exponent
   * (`E-36`) from being an expensive division, and truncates toward zero for
   * free.
   */
  const digits = `${intPart}${fracPart}`;
  const pointIndex = intPart.length + (exponentPart === undefined ? 0 : Number(exponentPart));

  if (pointIndex <= 0) return 0n;

  const integerDigits = pointIndex >= digits.length ? digits.padEnd(pointIndex, "0") : digits.slice(0, pointIndex);

  const magnitude = BigInt(integerDigits);
  return sign === "-" ? -magnitude : magnitude;
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
