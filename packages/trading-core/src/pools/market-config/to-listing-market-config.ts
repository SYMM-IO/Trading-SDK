import type { ListingDepositChainId } from "../types";
import type { UpdateMarketConfigResponseSchema } from "../types/generated/listing-backend";
import type { ListingMarketConfig } from "./types";

/**
 * Map the listing service's raw `/v2/market/config` body into the SDK's
 * {@link ListingMarketConfig}.
 *
 * Both endpoints on that path — the `GET` read and the `POST` write — return the
 * same schema, so both actions share this mapper. Nothing is rescaled: the four
 * numbers are plain whole values on the wire (`50` = 50%, `20` = 20x), unlike
 * every money field on the listing service. The nullable `user_*` fields are
 * normalized from `undefined` to `null`, so "never configured" is one value
 * rather than two.
 *
 * @param raw - The service's `/v2/market/config` response body.
 * @returns The normalized market config.
 */
export function toListingMarketConfig(raw: UpdateMarketConfigResponseSchema): ListingMarketConfig {
  return {
    tokenContractAddress: raw.token_contract_address,
    depositChain: raw.deposit_chain as ListingDepositChainId,
    userMaxLeverage: raw.user_max_leverage ?? null,
    userBuybackRatio: raw.user_buyback_ratio ?? null,
    maxLeverage: raw.max_leverage,
    buybackRatio: raw.buyback_ratio,
  };
}
