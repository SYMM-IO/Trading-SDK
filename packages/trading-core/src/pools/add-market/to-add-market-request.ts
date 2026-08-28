import type {
  AddMarketDepositRequestSchemaV2,
  AllKnownChains,
  KnowCEXs,
  SupportedDepositChains,
} from "../types/generated/listing-backend";
import type { AddMarketParameters } from "./add-market";

/**
 * Build the `/v2/market/add-market` request body from {@link AddMarketParameters}.
 *
 * The five required fields are always set. Every optional listing extra is
 * included **only when the caller defined it** — the SDK does not default the
 * extras, so an omitted one is absent from the body entirely. A value the caller
 * *did* provide is always sent, including `isTax: false` and an empty
 * `additionalChains: []`; only `undefined` is dropped.
 *
 * @param parameters - The create-pool inputs.
 * @returns The request body for `addMarketV2MarketAddMarketPost`.
 */
export function toAddMarketRequest(parameters: AddMarketParameters): AddMarketDepositRequestSchemaV2 {
  const body: AddMarketDepositRequestSchemaV2 = {
    token_contract_address: parameters.tokenContractAddress,
    buy_back_ratio: parameters.buyBackRatio,
    max_leverage: parameters.maxLeverage,
    // `ListingDepositChainId` and `SupportedDepositChains` share the same numeric
    // chain-id values, so this only re-labels the enum at the wire boundary.
    deposit_chain: parameters.depositChain as unknown as SupportedDepositChains,
  };

  if (parameters.isTax !== undefined) {
    body.is_tax = parameters.isTax;
  }
  if (parameters.userWhitelistTax !== undefined) {
    body.user_whitelist_tax = parameters.userWhitelistTax;
  }
  if (parameters.additionalChains !== undefined) {
    // `additionalChains` are plain chain-id numbers; `AllKnownChains` is the
    // generated numeric enum over the same values, so the cast only re-labels them.
    body.additional_chains = [...parameters.additionalChains] as unknown as AllKnownChains[];
  }
  if (parameters.poolAddress !== undefined) {
    body.pool_address = parameters.poolAddress;
  }
  if (parameters.cexList !== undefined) {
    // `cexList` are CEX name strings; `KnowCEXs` is the generated string enum over
    // the same values, so the cast only re-labels them.
    body.cex_list = [...parameters.cexList] as unknown as KnowCEXs[];
  }

  return body;
}
