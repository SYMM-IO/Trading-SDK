import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter } from "../../shared/types/properties";
import { toListingValue } from "../markets/to-listing-market";
import { resolveListingService } from "../resolve-listing";
import { getMaintenanceFeeRecordsV2MarketMaintenanceFeesGet } from "../types/generated/listing-backend";

/** One maintenance sale, with monetary values at 18 decimals. */
export interface PoolMaintenanceFee {
  /** Tokens sold. */ tokenAmount: bigint;
  /** USDC received. */ usdcAmount: bigint;
  /** Execution time in Unix seconds. */ timestamp: number;
  /** On-chain hash, when supplied. */ transactionHash: string | null;
}
/** Paginated maintenance sales. */
export interface PoolMaintenanceFees {
  /** Total records. */ total: number;
  /** This page's sales. */ items: PoolMaintenanceFee[];
}
/** Inputs for {@link getPoolMaintenanceFees}. Deployment chainId is separate from depositChain. */
export type GetPoolMaintenanceFeesParameters = ChainIdParameter & {
  /** Pool token address. */
  tokenContractAddress: string;
  /** Chain the pool token lives on. */
  depositChain: number;
  /** Page size. */
  limit?: number;
  /** Page offset. */
  offset?: number;
};
/** Result of {@link getPoolMaintenanceFees}. */
export type GetPoolMaintenanceFeesReturnType = PoolMaintenanceFees;

/**
 * Read a pool's maintenance-sale history from the configured listing service.
 * @param config - SDK configuration.
 * @param parameters - Token identity and request parameters.
 * @returns The normalized service result.
 * @example
 * await getPoolMaintenanceFees(config, { chainId: 42161, depositChain: 0, tokenContractAddress: mint });
 */
export async function getPoolMaintenanceFees(
  config: Config,
  parameters: GetPoolMaintenanceFeesParameters,
): Promise<GetPoolMaintenanceFeesReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });
  try {
    const { data } = await getMaintenanceFeeRecordsV2MarketMaintenanceFeesGet(
      {
        market_address: parameters.tokenContractAddress,
        chain_id: parameters.depositChain,
        limit: parameters.limit,
        offset: parameters.offset,
      },
      { baseURL },
    );
    return {
      total: data.total,
      items: data.items.map((row) => ({
        tokenAmount: toListingValue(row.token_amount) ?? 0n,
        usdcAmount: toListingValue(row.usdc_amount) ?? 0n,
        timestamp: row.timestamp / 1000,
        transactionHash: row.tx_hash ?? null,
      })),
    };
  } catch (error) {
    if (error instanceof SymmError) throw error;
    if (isAxiosError(error)) throw SymmApiError.fromAxios(error, { code: "GET_POOL_MAINTENANCE_FEES_FAILED", baseURL });
    throw new SymmError("api", "GET_POOL_MAINTENANCE_FEES_FAILED", "Listing request failed", { cause: error });
  }
}
