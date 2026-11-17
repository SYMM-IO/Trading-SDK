import { toListingValue } from "../markets/to-listing-market";
import type { ListingConfig, ListingDepositChain, ListingRateLimits } from "../types";
import { ListingDepositChainId } from "../types";
import type { ClientConfigResponse, SupportedDepositChainConfig } from "../types/generated/listing-backend";

// Older deployments omit USD-token metadata; tolerate null at the response boundary too.
type CompatibleDepositChain = Omit<SupportedDepositChainConfig, "usd_token"> & {
  usd_token?: SupportedDepositChainConfig["usd_token"] | null;
};

/**
 * Map one raw `SupportedDepositChainConfig` into a {@link ListingDepositChain}.
 *
 * @param raw - One entry of the config's `supported_deposit_chains` array.
 * @returns The normalized deposit chain.
 */
function toListingDepositChain(raw: CompatibleDepositChain): ListingDepositChain {
  return {
    chainId: raw.chain_id as ListingDepositChainId,
    chainName: raw.chain_name,
    ...(raw.usd_token == null
      ? {}
      : { usdToken: { address: raw.usd_token.address, decimals: raw.usd_token.decimals } }),
  };
}

/**
 * Map the listing service's raw `ClientConfigResponse` into the SDK's
 * {@link ListingConfig}.
 *
 * The three `*_usdc` figures are required 18-decimal strings; each is parsed
 * with {@link toListingValue} and defaulted to `0n` if the service ever returns
 * a malformed value (`toListingValue` returns `null` there). The wire's
 * snake_case becomes the SDK's camelCase. USD-token addresses and native
 * decimals are copied verbatim, independently of the 18-decimal money fields.
 * Missing or null USD-token metadata is omitted for older deployments.
 *
 * @param raw - The service's `/v2/configs` response body.
 * @returns The normalized listing config.
 */
export function toListingConfig(
  raw: Omit<Partial<ClientConfigResponse>, "rate_limits" | "supported_deposit_chains"> & {
    supported_deposit_chains?: CompatibleDepositChain[];
    rate_limits?: Partial<ClientConfigResponse["rate_limits"]>;
    minimum_initial_deposit_usdc?: string | null;
    recommended_initial_deposit_usdc?: string | null;
  },
): ListingConfig {
  const legacyMinimum =
    "minimum_initial_deposit_usdc" in raw && typeof raw.minimum_initial_deposit_usdc === "string"
      ? raw.minimum_initial_deposit_usdc
      : undefined;
  const legacyRecommended =
    "recommended_initial_deposit_usdc" in raw && typeof raw.recommended_initial_deposit_usdc === "string"
      ? raw.recommended_initial_deposit_usdc
      : undefined;
  const isLegacy = legacyMinimum != null || legacyRecommended != null;
  const minimumDepositUsdc = toListingValue(isLegacy ? legacyMinimum : raw.minimum_deposit_usdc);
  const recommendedDepositUsdc = toListingValue(raw.recommended_deposit_usdc ?? legacyRecommended);
  const bounds = raw.max_leverage_bounds;
  const maxLeverageBounds =
    bounds && Number.isFinite(bounds.minimum) && Number.isFinite(bounds.maximum) && bounds.minimum <= bounds.maximum
      ? { minimum: bounds.minimum, maximum: bounds.maximum }
      : null;
  const rateLimits: ListingRateLimits = {
    marketConfigUpdatesPerDay: raw.rate_limits?.market_config_updates_per_day ?? null,
    profitClaimsPerDay: raw.rate_limits?.profit_claims_per_day ?? null,
  };

  return {
    recommendedDepositUsdc,
    minimumDepositUsdc,
    legacyUniversalDepositFloorUsdc: isLegacy ? toListingValue(raw.minimum_deposit_usdc) : null,
    reportedListingFeeUsdc: toListingValue(raw.listing_fee_usdc),
    maxLeverageBounds,
    reportedMarketConfigUpdatesPerDay: raw.rate_limits?.market_config_updates_per_day ?? null,
    reportedProfitClaimsPerDay: raw.rate_limits?.profit_claims_per_day ?? null,
    reportedProtocolRewardSharePercent: raw.protocol_reward_share_percent ?? null,
    recommendedInitialDepositUsdc: recommendedDepositUsdc ?? 0n,
    minimumInitialDepositUsdc: minimumDepositUsdc ?? 0n,
    listingFeeUsdc: toListingValue(raw.listing_fee_usdc) ?? 0n,
    supportedDepositChains: (raw.supported_deposit_chains ?? []).map(toListingDepositChain),
    rateLimits,
    protocolRewardSharePercent: raw.protocol_reward_share_percent ?? 0,
  };
}
