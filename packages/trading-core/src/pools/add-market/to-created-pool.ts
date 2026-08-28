import type { ListingDepositChainId, ListingMarketStatus } from "../types";
import type { AddMarketDepositResponseSchemaV2 } from "../types/generated/listing-backend";
import type { CreatedPool } from "./types";

/**
 * Map the raw `/v2/market/add-market` response into the SDK's {@link CreatedPool}.
 *
 * Renames snake_case wire fields to camelCase and normalizes the two nullable
 * addresses to `null` when absent. `deposit_chain` is a numeric chain id that
 * matches {@link ListingDepositChainId}, and the generated `MarketStatus` carries
 * the same string values as {@link ListingMarketStatus}, so both casts are
 * value-preserving.
 *
 * @param raw - The endpoint's `/v2/market/add-market` response body.
 * @returns The normalized created pool.
 */
export function toCreatedPool(raw: AddMarketDepositResponseSchemaV2): CreatedPool {
  return {
    tokenContractAddress: raw.token_contract_address,
    userAddress: raw.user_address,
    tokenName: raw.token_name,
    tokenTicker: raw.token_ticker,
    tokenDecimal: raw.token_decimal,
    buyBackRatio: raw.buy_back_ratio,
    maxLeverage: raw.max_leverage,
    depositChain: raw.deposit_chain as ListingDepositChainId,
    marketStatus: raw.market_status as unknown as ListingMarketStatus,
    walletPublicKey: raw.wallet_public_key ?? null,
    mainPool: raw.main_pool ?? null,
  };
}
