import { toListingValue } from "../markets/to-listing-market";
import type { ListingConfig, ListingDepositChain, ListingRateLimits } from "../types";
import { ListingDepositChainId } from "../types";
import type { ClientConfigResponse, SupportedDepositChainConfig } from "../types/generated/listing-backend";

/**
 * Map one raw `SupportedDepositChainConfig` into a {@link ListingDepositChain}.
 *
 * @param raw - One entry of the config's `supported_deposit_chains` array.
 * @returns The normalized deposit chain.
 */
function toListingDepositChain(raw: SupportedDepositChainConfig): ListingDepositChain {
  return {
    chainId: raw.chain_id as ListingDepositChainId,
    chainName: raw.chain_name,
  };
}

/**
 * Map the listing service's raw `ClientConfigResponse` into the SDK's
 * {@link ListingConfig}.
 *
 * The three `*_usdc` figures are required 18-decimal strings; each is parsed
 * with {@link toListingValue} and defaulted to `0n` if the service ever returns
 * a malformed value (`toListingValue` returns `null` there). The wire's
 * snake_case becomes the SDK's camelCase.
 *
 * @param raw - The service's `/v2/configs` response body.
 * @returns The normalized listing config.
 */
export function toListingConfig(raw: ClientConfigResponse): ListingConfig {
  const rateLimits: ListingRateLimits = {
    marketConfigUpdatesPerDay: raw.rate_limits.market_config_updates_per_day,
    profitClaimsPerDay: raw.rate_limits.profit_claims_per_day,
  };

  return {
    recommendedInitialDepositUsdc: toListingValue(raw.recommended_initial_deposit_usdc) ?? 0n,
    minimumInitialDepositUsdc: toListingValue(raw.minimum_initial_deposit_usdc) ?? 0n,
    listingFeeUsdc: toListingValue(raw.listing_fee_usdc) ?? 0n,
    supportedDepositChains: raw.supported_deposit_chains.map(toListingDepositChain),
    rateLimits,
    protocolRewardSharePercent: raw.protocol_reward_share_percent,
  };
}
