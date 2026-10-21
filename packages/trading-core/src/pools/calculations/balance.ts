import type { UserPoolProfit } from "../types";

/** Unformatted position amounts, with pending withdrawals separated from available funds. */
export interface PoolBalanceBreakdown {
  availableToken: number;
  availableUsdc: number;
  pendingToken: number;
  pendingUsdc: number;
  hasPending: boolean;
  availableRatio: number;
  totalToken: number;
  totalUsdc: number;
  availableLpRaw: bigint;
  totalLpRaw: bigint;
}

/** Split a position using its LP ledger. All incoming amounts are 18-decimal integers, even dust. */
export function getPoolBalanceBreakdown(
  profit:
    | Pick<UserPoolProfit, "userLpAmount" | "pendingWithdrawLpAmount" | "userBalanceInTokens" | "userBalanceInUsdc">
    | null
    | undefined,
): PoolBalanceBreakdown {
  const totalLpRaw = profit?.userLpAmount ?? 0n;
  const pendingLpRaw = profit?.pendingWithdrawLpAmount ?? 0n;
  const availableLpRaw = totalLpRaw > pendingLpRaw ? totalLpRaw - pendingLpRaw : 0n;
  const availableRatio = totalLpRaw > 0n ? Number(availableLpRaw) / Number(totalLpRaw) : 0;
  const pendingRatio = totalLpRaw > 0n ? Number(pendingLpRaw) / Number(totalLpRaw) : 0;
  const totalToken = Number(profit?.userBalanceInTokens ?? 0n) / 1e18;
  const totalUsdc = Number(profit?.userBalanceInUsdc ?? 0n) / 1e18;
  return {
    availableToken: totalToken * availableRatio,
    availableUsdc: totalUsdc * availableRatio,
    pendingToken: totalToken * pendingRatio,
    pendingUsdc: totalUsdc * pendingRatio,
    hasPending: pendingLpRaw > 0n,
    availableRatio,
    totalToken,
    totalUsdc,
    availableLpRaw,
    totalLpRaw,
  };
}

/** Value the entire position in USD. A missing position is unknown; an unpriced token contributes only its USDC leg. */
export function getPoolBalanceUsd(
  profit: Parameters<typeof getPoolBalanceBreakdown>[0],
  priceUsd: number | null | undefined,
): number | null {
  if (!profit) return null;
  const { totalToken, totalUsdc } = getPoolBalanceBreakdown(profit);
  return totalUsdc + (priceUsd != null && Number.isFinite(priceUsd) ? totalToken * priceUsd : 0);
}

/** Select the user's fraction from the LP-ledger percentage, then the same-snapshot USDC ratio; missing stays unknown. */
export function selectPoolShareFraction(
  sharePercent: number | null | undefined,
  userUsdc?: number,
  totalUsdc?: number,
): number | null {
  const value =
    sharePercent != null && Number.isFinite(sharePercent)
      ? sharePercent / 100
      : totalUsdc != null && totalUsdc > 0 && userUsdc != null
        ? userUsdc / totalUsdc
        : null;
  return value != null && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

/** Scale a pool-wide amount by a known fraction; absent amounts or ownership remain unknown. */
export function scalePoolAmountByShare(value: number | null | undefined, fraction: number | null): number | null {
  return value == null || !Number.isFinite(value) || fraction == null ? null : value * fraction;
}

/** Project a submitted LP or reward operation using its raw 18-decimal amount; acceptance is separate from settlement. */
export function projectPoolProfitOperation(
  profit: { pendingWithdrawLpAmount: bigint; claimableReward: bigint },
  kind: "withdraw" | "cancel" | "claim",
  amount: bigint,
) {
  const nonnegative = amount > 0n ? amount : 0n;
  return {
    pendingWithdrawLpAmount:
      kind === "withdraw"
        ? profit.pendingWithdrawLpAmount + nonnegative
        : kind === "cancel"
          ? profit.pendingWithdrawLpAmount > nonnegative
            ? profit.pendingWithdrawLpAmount - nonnegative
            : 0n
          : profit.pendingWithdrawLpAmount,
    claimableReward:
      kind === "claim"
        ? profit.claimableReward > nonnegative
          ? profit.claimableReward - nonnegative
          : 0n
        : profit.claimableReward,
  };
}
