import { toListingValue } from "../markets/to-listing-market";
import type { UserPoolProfit } from "../types";
import type { LPTokenProfitSchema } from "../types/generated/listing-backend";

/**
 * Map one raw `LPTokenProfitSchema` from the authed `/v2/profit/{token}` endpoint
 * into the SDK's {@link UserPoolProfit}.
 *
 * Every field is an 18-decimal decimal string on the wire; each is parsed through
 * {@link toListingValue} and defaulted to `0n` when the service omits it or sends
 * an empty value — a missing figure on this per-user read means "nothing here",
 * so zero is the right collapse (unlike the catalog rows, where absent stays
 * `null`).
 *
 * `availableLpAmount` is **derived**, not a wire field: the LP shares free to
 * withdraw are the user's shares minus what is already queued
 * (`userLpAmount − pendingWithdrawLpAmount`), floored at `0n` so a pending amount
 * that meets or exceeds the balance never reads as negative.
 *
 * @param raw - The endpoint's `/v2/profit/{token_contract_address}` response body.
 * @returns The normalized user pool profit.
 */
export function toUserPoolProfit(raw: LPTokenProfitSchema): UserPoolProfit {
  const userLpAmount = toListingValue(raw.user_lp_amount) ?? 0n;
  const pendingWithdrawLpAmount = toListingValue(raw.pending_withdraw_lp_amount) ?? 0n;

  return {
    userBalanceInTokens: toListingValue(raw.user_balance_in_tokens) ?? 0n,
    userBalanceInUsdc: toListingValue(raw.user_balance_in_usdc) ?? 0n,
    claimableReward: toListingValue(raw.claimable_reward) ?? 0n,
    claimedReward: toListingValue(raw.claimed_reward) ?? 0n,
    userDepositedTokenAmount: toListingValue(raw.user_deposited_token_amount) ?? 0n,
    userLpAmount,
    pendingWithdrawLpAmount,
    availableLpAmount: userLpAmount > pendingWithdrawLpAmount ? userLpAmount - pendingWithdrawLpAmount : 0n,
  };
}
