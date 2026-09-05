import { toListingValue } from "../markets/to-listing-market";
import {
  PoolPositionSide,
  type ListingApyWindows,
  type ListingDepositChainId,
  type ListingMarketDetail,
  type ListingMarketStatus,
  type PoolPosition,
} from "../types";
import type { GetMarketResponseSchema } from "../types/generated/listing-backend";

/** Parse a required 18-decimal figure, defaulting an absent one to `0n`. */
function toRequiredValue(raw: string | null | undefined): bigint {
  return toListingValue(raw) ?? 0n;
}

/**
 * Map the five windows of a metric whose wire keys share `prefix`.
 *
 * The detail response reports every series over the same five windows, unlike
 * the catalogue where only the APY series carry a lifetime column.
 */
function toWindows(raw: GetMarketResponseSchema, prefix: string): ListingApyWindows {
  const row = raw as unknown as Record<string, string | null | undefined>;
  return {
    h1: toListingValue(row[`${prefix}_1h`]),
    h6: toListingValue(row[`${prefix}_6h`]),
    h24: toListingValue(row[`${prefix}_24h`]),
    d30: toListingValue(row[`${prefix}_30d`]),
    lifetime: toListingValue(row[`${prefix}_lifetime`]),
  };
}

/**
 * Build one side's {@link PoolPosition}, or `null` when the backend reported no
 * size for it.
 *
 * `null` rather than a zero row on purpose: a pool with no short inventory and a
 * pool whose short side nets to zero are different states, and the table should
 * be able to tell them apart.
 */
function toPosition(
  side: PoolPositionSide,
  size: string | null | undefined,
  value: string | null | undefined,
  avgOpenPrice: string | null | undefined,
  upnl: string | null | undefined,
): PoolPosition | null {
  const parsedSize = toListingValue(size);
  if (parsedSize === null) return null;

  return {
    side,
    size: parsedSize,
    value: toRequiredValue(value),
    avgOpenPrice: toRequiredValue(avgOpenPrice),
    upnl: toRequiredValue(upnl),
  };
}

/**
 * Map the listing backend's `GET /v2/market` response into the SDK's
 * {@link ListingMarketDetail}.
 *
 * @param raw - The raw market-detail response body.
 * @returns The normalized pool detail.
 */
export function toListingMarketDetail(raw: GetMarketResponseSchema): ListingMarketDetail {
  return {
    tokenContractAddress: raw.token_contract_address,
    depositChain: raw.deposit_chain as ListingDepositChainId,
    tokenName: raw.token_name,
    tokenTicker: raw.token_ticker ?? null,
    tokenDecimal: raw.token_decimal,
    symbolId: raw.symbol_id ?? null,
    marketStatus: raw.market_status as unknown as ListingMarketStatus,
    maxLeverage: raw.max_leverage,
    buybackRatio: raw.buyback_ratio,
    listingTime: raw.listing_time ?? null,
    age: raw.age ?? null,
    activeLps: raw.active_lps,
    tvl: toListingValue(raw.tvl),
    totalUsdcInPool: toRequiredValue(raw.total_usdc_in_pool),
    totalTokenInPool: toRequiredValue(raw.total_token_in_pool),
    maintenanceFees: toRequiredValue(raw.maintenance_fees),
    rewards: toWindows(raw, "reward"),
    solverRevenue: toWindows(raw, "solver_revenue"),
    apy: toWindows(raw, "apy"),
    tvlDrivenApy: toWindows(raw, "tvl_driven_apy"),
    priceDrivenApy: toWindows(raw, "price_driven_apy"),
    longPosition: toPosition(
      PoolPositionSide.LONG,
      raw.long_position_amount,
      raw.long_position_value,
      raw.long_position_avg_open_price,
      raw.long_position_upnl,
    ),
    shortPosition: toPosition(
      PoolPositionSide.SHORT,
      raw.short_position_amount,
      raw.short_position_value,
      raw.short_position_avg_open_price,
      raw.short_position_upnl,
    ),
  };
}
