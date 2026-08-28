import type { ListingDepositChainId, ListingMarketStatus, MarketDepositAddress } from "../types";
import type { DepositResponseSchemaV2 } from "../types/generated/listing-backend";

/**
 * Map the raw `/v2/market/deposit-address` response into the SDK's
 * {@link MarketDepositAddress}.
 *
 * Renames the snake_case wire fields to camelCase and normalizes the nullable
 * `wallet_public_key` to `null` when absent. `deposit_chain` is a numeric chain
 * id that matches {@link ListingDepositChainId}, and the generated `MarketStatus`
 * carries the same string values as {@link ListingMarketStatus}, so both casts
 * are value-preserving.
 *
 * @param raw - The endpoint's `/v2/market/deposit-address` response body.
 * @returns The normalized market deposit address.
 */
export function toMarketDepositAddress(raw: DepositResponseSchemaV2): MarketDepositAddress {
  return {
    tokenContractAddress: raw.token_contract_address,
    userAddress: raw.user_address,
    depositChain: raw.deposit_chain as ListingDepositChainId,
    depositAddress: raw.wallet_public_key ?? null,
    tokenDecimal: raw.token_decimal,
    marketStatus: raw.market_status as unknown as ListingMarketStatus,
  };
}
