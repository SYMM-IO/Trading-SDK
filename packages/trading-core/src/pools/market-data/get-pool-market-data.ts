import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError } from "../../shared/errors/symm-error";
import type { ChainIdParameter } from "../../shared/types/properties";
import { toListingPercent, toListingValue } from "../markets/to-listing-market";
import { resolveListingService } from "../resolve-listing";
import { getPoolsV2PoolsGet } from "../types/generated/listing-backend";

/** Inventory-backed legacy pool metric pair, at 18 decimals. */
export interface PoolMarketData {
  marketCap: bigint | null;
  apr: bigint | null;
}
/** Deployment and exact token addresses for the legacy batch metrics read. */
export type GetPoolMarketDataParameters = ChainIdParameter & { addresses: readonly string[] };

/** Read the legacy pool metrics in one request, preserving address keys and unknown values. */
export async function getPoolMarketData(
  config: Config,
  parameters: GetPoolMarketDataParameters,
): Promise<Record<string, PoolMarketData>> {
  const { url: baseURL } = resolveListingService(config, parameters);
  try {
    const { data } = await getPoolsV2PoolsGet({ addresses: parameters.addresses.join(",") }, { baseURL });
    return Object.fromEntries(
      Object.entries(data).map(([address, value]) => [
        address,
        { marketCap: toListingValue(value.market_cap), apr: toListingPercent(value.apr) },
      ]),
    );
  } catch (error) {
    if (isAxiosError(error)) throw SymmApiError.fromAxios(error, { code: "GET_POOL_MARKET_DATA_FAILED", baseURL });
    throw error;
  }
}
