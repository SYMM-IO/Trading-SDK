import type { WithdrawRequest } from "../types/generated/listing-backend";
import type { WithdrawLpParameters } from "./withdraw-lp";

/**
 * Build the `/v2/market/withdraw` request body from {@link WithdrawLpParameters}.
 *
 * `amount` is serialized from the SDK's raw 18-decimal `bigint` to the decimal
 * string the endpoint expects ("lp amount to withdraw in 1e18 units") — the
 * `bigint` already counts 1e18 units, so this is a plain `toString()` with no
 * rescaling. `description` is included **only when the caller set it**; an
 * omitted note is absent from the body.
 *
 * @param parameters - The withdrawal inputs.
 * @returns The request body for `withdrawV2MarketWithdrawPost`.
 */
export function toWithdrawRequest(parameters: WithdrawLpParameters): WithdrawRequest {
  const body: WithdrawRequest = {
    amount: parameters.amount.toString(),
    market_address: parameters.marketAddress,
    withdraw_address: parameters.withdrawAddress,
  };

  if (parameters.description !== undefined) {
    body.description = parameters.description;
  }

  return body;
}
