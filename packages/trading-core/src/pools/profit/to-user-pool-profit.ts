import { parseListingValue, toListingPercent, toListingValue } from "../markets/to-listing-market";
import type { UserPoolProfit } from "../types";
import type { LPTokenProfitSchema } from "../types/generated/listing-backend";

/**
 * Map one raw `LPTokenProfitSchema` from the authed `/v2/profit/{token}` endpoint
 * into the SDK's {@link UserPoolProfit}.
 *
 * Most fields arrive already 1e18-scaled and are read with {@link toListingValue}.
 * The exception is `claimable_reward`, which the service reports in **plain
 * decimal units** (`"0.0377"` = `$0.0377`, not `"37699391270769714"`) — it is
 * scaled up with {@link parseListingValue} so the SDK still exposes a uniform
 * 18-decimal `bigint`. Running it through `toListingValue` like the others would
 * truncate the value to its integer part (`0n`).
 *
 * Core position fields retain their existing `0n` defaults. Supplemental market
 * snapshots (TVL, APY, position metrics and totals) retain absence as `null` so
 * callers can distinguish an unknown rollout field from a measured zero.
 *
 * `availableLpAmount` is **derived**, not a wire field: the LP shares free to
 * withdraw are the user's shares minus what is already queued
 * (`userLpAmount − pendingWithdrawLpAmount`), floored at `0n` so a pending amount
 * that meets or exceeds the balance never reads as negative.
 *
 * @param raw - The endpoint's `/v2/profit/{token_contract_address}` response body.
 * @returns The normalized user pool profit.
 */
export function toUserPoolProfit(
  raw: LPTokenProfitSchema & {
    tvl?: string | null;
    apy_30d?: string | null;
    long_position_amount?: string | null;
    long_position_value?: string | null;
    long_position_avg_open_price?: string | null;
    long_position_upnl?: string | null;
    short_position_amount?: string | null;
    short_position_value?: string | null;
    short_position_avg_open_price?: string | null;
    short_position_upnl?: string | null;
    apy_lifetime?: string | null;
    apy_all_time?: string | null;
    total_usdc_in_pool?: string | null;
    total_token_in_pool?: string | null;
    buyback_ratio?: string | number | null;
    active_lps?: number | null;
    age?: number | null;
  },
): UserPoolProfit {
  const userLpAmount = toListingValue(raw.user_lp_amount) ?? 0n;
  const pendingWithdrawLpAmount = toListingValue(raw.pending_withdraw_lp_amount) ?? 0n;

  return {
    tvl: toListingValue(raw.tvl),
    apy30d: toListingPercent(raw.apy_30d),
    longPositionAmount: toListingValue(raw.long_position_amount),
    longPositionValue: toListingValue(raw.long_position_value),
    longPositionAvgOpenPrice: toListingValue(raw.long_position_avg_open_price),
    longPositionUpnl: toListingValue(raw.long_position_upnl),
    shortPositionAmount: toListingValue(raw.short_position_amount),
    shortPositionValue: toListingValue(raw.short_position_value),
    shortPositionAvgOpenPrice: toListingValue(raw.short_position_avg_open_price),
    shortPositionUpnl: toListingValue(raw.short_position_upnl),
    apyLifetime: toListingPercent(raw.apy_lifetime ?? raw.apy_all_time),
    buybackRatio: raw.buyback_ratio == null ? null : Number(raw.buyback_ratio),
    activeLps: raw.active_lps ?? null,
    age: raw.age ?? null,
    totalUsdcInPool: toListingValue(raw.total_usdc_in_pool),
    totalTokenInPool: toListingValue(raw.total_token_in_pool),
    userBalanceInTokens: toListingValue(raw.user_balance_in_tokens) ?? 0n,
    userBalanceInUsdc: toListingValue(raw.user_balance_in_usdc) ?? 0n,
    claimableReward: parseListingValue(raw.claimable_reward) ?? 0n,
    claimedReward: toListingValue(raw.claimed_reward) ?? 0n,
    userDepositedTokenAmount: toListingValue(raw.user_deposited_token_amount) ?? 0n,
    userLpAmount,
    pendingWithdrawLpAmount,
    availableLpAmount: userLpAmount > pendingWithdrawLpAmount ? userLpAmount - pendingWithdrawLpAmount : 0n,
  };
}
