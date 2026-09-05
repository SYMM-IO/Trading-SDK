import type { ClaimProfitRequestSchema } from "../types/generated/listing-backend";
import type { ClaimProfitParameters } from "./claim-profit";

/**
 * Build the `/v2/claim` request body from {@link ClaimProfitParameters}.
 *
 * `amount` is serialized from the SDK's raw 18-decimal `bigint` to the decimal
 * string the endpoint expects — the `bigint` already counts 1e18 units (the same
 * scale `UserPoolProfit.claimableReward` is reported in), so this is a plain
 * `toString()` with no rescaling.
 *
 * @param parameters - The claim inputs.
 * @returns The request body for `claimProfitV2ClaimPost`.
 */
export function toClaimRequest(parameters: ClaimProfitParameters): ClaimProfitRequestSchema {
  return {
    token_contract_address: parameters.tokenContractAddress,
    deposit_chain: parameters.depositChain,
    account_address: parameters.accountAddress,
    amount: parameters.amount.toString(),
  };
}
