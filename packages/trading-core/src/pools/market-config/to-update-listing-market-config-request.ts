import type { SupportedDepositChains, UpdateMarketConfigRequestSchema } from "../types/generated/listing-backend";
import type { UpdateListingMarketConfigParameters } from "./update-listing-market-config";

/**
 * Build the `POST /v2/market/config` request body from
 * {@link UpdateListingMarketConfigParameters}.
 *
 * Both knobs are optional on the wire, and an omitted one leaves the caller's
 * current value untouched — so an `undefined` input is dropped rather than sent
 * as `null`. Both are whole integers: the endpoint rejects a fractional value,
 * and a slider that emits `19.5` must round before it gets here.
 *
 * Note the wire field is `buyback_ratio` — one word — while `add-market`'s is
 * `buy_back_ratio`. They are different endpoints with different spellings; the
 * SDK mirrors each one's own field.
 *
 * @param parameters - The update inputs.
 * @returns The request body for `updateMarketConfigV2MarketConfigPost`.
 */
export function toUpdateListingMarketConfigRequest(
  parameters: UpdateListingMarketConfigParameters,
): UpdateMarketConfigRequestSchema {
  return {
    token_contract_address: parameters.tokenContractAddress,
    // Value-preserving: SupportedDepositChains shares the same numeric chain-id values as ListingDepositChainId.
    deposit_chain: parameters.depositChain as unknown as SupportedDepositChains,
    ...(parameters.maxLeverage === undefined ? {} : { max_leverage: parameters.maxLeverage }),
    ...(parameters.buybackRatio === undefined ? {} : { buyback_ratio: parameters.buybackRatio }),
  };
}
