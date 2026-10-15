import axios, { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import type { GetListingMarketsParameters } from "../../pools/markets/get-listing-markets";
import { toSearchParams } from "../../pools/markets/to-search-params";
import { resolveListingService } from "../../pools/resolve-listing";
import type { ListingMarketStatus } from "../../pools/types";
import { SymmApiError } from "../../shared/errors/symm-error";
import { invalid, record, symbolId } from "../read";

/** Public listing page, including the Inventory deposit-lock filter. */
export type GetListingMarketSnapshotParameters = GetListingMarketsParameters & { isLocked?: boolean };
const metricFields = {
  priceUsd: "price_usd",
  marketCap: "market_cap",
  vol24h: "vol24h",
  liquidity: "liquidity",
  tvl: "tvl",
  openInterest: "open_interest",
  apr: "apr",
  apr1h: "apr_1h",
  apr6h: "apr_6h",
  apr24h: "apr_24h",
  apr30d: "apr_30d",
  apy24h: "apy_24h",
  apy30d: "apy_30d",
  apyLifetime: "apy_lifetime",
  reward24h: "reward_24h",
  reward30d: "reward_30d",
  rewardLifetime: "reward_lifetime",
  solverRevenue24h: "solver_revenue_24h",
  solverRevenue30d: "solver_revenue_30d",
  solverRevenueLifetime: "solver_revenue_lifetime",
  tvlDrivenApy1h: "tvl_driven_apy_1h",
  tvlDrivenApy6h: "tvl_driven_apy_6h",
  tvlDrivenApy24h: "tvl_driven_apy_24h",
  tvlDrivenApy30d: "tvl_driven_apy_30d",
  tvlDrivenApyLifetime: "tvl_driven_apy_lifetime",
  priceDrivenApy1h: "price_driven_apy_1h",
  priceDrivenApy6h: "price_driven_apy_6h",
  priceDrivenApy24h: "price_driven_apy_24h",
  priceDrivenApy30d: "price_driven_apy_30d",
  priceDrivenApyLifetime: "price_driven_apy_lifetime",
} as const;
/**
 * Exact advertised decimals. USD metrics retain their service 1e18 scale;
 * priceUsd and APR/APY can use legacy plain units. No scaling or truncation is
 * inferred. Absent metrics remain absent; explicit null remains null.
 */
export type ListingMarketDecimalMetrics = { -readonly [K in keyof typeof metricFields]?: string | null };
/** Public catalog row retaining exact advertised financial values. */
export type DecimalListingMarket = ListingMarketDecimalMetrics & {
  contractAddress: string;
  chainId: number;
  symbolId: number | null;
  tokenTicker: string;
  tokenName: string;
  maxLeverage: number;
  listingTime: number | null;
  marketStatus: ListingMarketStatus;
  isLocked?: boolean | null;
};
/** One page; callers choose their pagination and freshness policy. */
export interface GetListingMarketSnapshotReturnType {
  total: number;
  limit: number;
  offset: number;
  items: DecimalListingMarket[];
}

/**
 * Read `/v2/market/search` without losing fractional tails or legacy metrics.
 * Existing getListingMarkets bigint normalization is unchanged. Use this read
 * when adapting a deployment that still advertises legacy percentage units.
 */
export async function getListingMarketSnapshot(
  config: Config,
  parameters: GetListingMarketSnapshotParameters = {},
): Promise<GetListingMarketSnapshotReturnType> {
  const { url: baseURL } = resolveListingService(config, parameters);
  try {
    const { data } = await axios.get<unknown>("/v2/market/search", {
      baseURL,
      timeout: 10_000,
      paramsSerializer: { indexes: null },
      params: {
        ...toSearchParams({ ...parameters, query: parameters.search }),
        ...(parameters.isLocked !== undefined ? { is_locked: parameters.isLocked } : {}),
      },
    });
    const page = record(data);
    if (!page || !Array.isArray(page.items)) invalid("Invalid listing market page");
    const items = page.items.map((value) => {
      const row = record(value);
      if (
        !row ||
        typeof row.contract_address !== "string" ||
        typeof row.token_ticker !== "string" ||
        typeof row.token_name !== "string" ||
        typeof row.market_status !== "string"
      )
        invalid("Invalid listing market identity");
      const metrics: ListingMarketDecimalMetrics = {};
      for (const [field, wire] of Object.entries(metricFields)) {
        const value = row[wire];
        if (value === undefined) continue;
        if (value !== null && typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value)))
          invalid("Invalid listing metric");
        metrics[field as keyof ListingMarketDecimalMetrics] = value === null ? null : String(value);
      }
      return {
        ...metrics,
        contractAddress: row.contract_address,
        chainId: Number(row.chain_id),
        symbolId: symbolId(row.symbol_id) ?? null,
        tokenTicker: row.token_ticker,
        tokenName: row.token_name,
        maxLeverage: Number(row.max_leverage),
        listingTime: row.listing_time == null ? null : Number(row.listing_time),
        marketStatus: row.market_status as ListingMarketStatus,
        ...(row.is_locked === null || typeof row.is_locked === "boolean" ? { isLocked: row.is_locked } : {}),
      };
    });
    return {
      items,
      total: Number(page.total ?? 0),
      limit: Number(page.limit ?? parameters.limit ?? 20),
      offset: Number(page.offset ?? parameters.offset ?? 0),
    };
  } catch (error) {
    if (isAxiosError(error)) throw SymmApiError.fromAxios(error, { code: "FETCH_LISTING_MARKETS_FAILED", baseURL });
    throw error;
  }
}
