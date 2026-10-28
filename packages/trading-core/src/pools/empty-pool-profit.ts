import type { UserPoolProfit } from "./types";

/** A confirmed absence of an LP position, never a fallback for a failed read. */
export function emptyPoolProfit(): UserPoolProfit {
  return {
    userBalanceInTokens: 0n,
    userBalanceInUsdc: 0n,
    userLpAmount: 0n,
    pendingWithdrawLpAmount: 0n,
    availableLpAmount: 0n,
    userDepositedTokenAmount: 0n,
    claimableReward: 0n,
    claimedReward: 0n,
  };
}
