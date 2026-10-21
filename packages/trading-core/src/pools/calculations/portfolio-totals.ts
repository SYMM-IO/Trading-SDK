/** One portfolio position with unformatted amounts in human token/USD units. */
export interface PoolPortfolioTotalPosition {
  balanceUsd: number | null;
  depositedTokens: number;
  priceUsd?: number;
  apr?: number;
  /** The collateral leg is the historical APR weighting basis. */
  aprWeightUsdc: number;
  claimableReward: number;
  canClaim: boolean;
}

/** Historical rewards include fully withdrawn pools. */
export interface PoolPortfolioRewardPosition {
  claimed: number;
  claimable: number;
  optimisticClaimed?: number;
}

/** Calculate totals before client-side table filtering. The first equal top earner wins. */
export function getPoolPortfolioTotals(
  positions: readonly PoolPortfolioTotalPosition[],
  rewardPositions: readonly PoolPortfolioRewardPosition[],
  claimableRewards: readonly number[],
) {
  let weightedApr = 0;
  let totalWeight = 0;
  let totalBalance = 0;
  let totalDeposited = 0;
  let topIndex: number | undefined;
  for (const [index, position] of positions.entries()) {
    if (position.apr != null && position.apr > 0 && position.aprWeightUsdc > 0) {
      weightedApr += position.apr * position.aprWeightUsdc;
      totalWeight += position.aprWeightUsdc;
    }
    totalBalance += position.balanceUsd ?? 0;
    if (position.priceUsd != null) totalDeposited += position.depositedTokens * position.priceUsd;
    if (position.canClaim && (topIndex == null || position.claimableReward > positions[topIndex]!.claimableReward))
      topIndex = index;
  }
  const totalClaimableRewards = claimableRewards.reduce((sum, reward) => sum + reward, 0);
  const totalLifetimeRewards = rewardPositions.reduce(
    (sum, position) =>
      sum +
      (position.optimisticClaimed !== undefined
        ? Math.max(position.claimed, position.optimisticClaimed)
        : position.claimed + position.claimable),
    0,
  );
  return {
    avgApr: totalWeight > 0 ? weightedApr / totalWeight : 0,
    totalBalance,
    totalDeposited,
    totalClaimableRewards,
    totalLifetimeRewards,
    topIndex,
    roi: totalDeposited > 0 ? ((totalBalance - totalDeposited) / totalDeposited) * 100 : 0,
    topPoolPct:
      topIndex != null && totalClaimableRewards > 0
        ? Math.round((positions[topIndex]!.claimableReward / totalClaimableRewards) * 100)
        : undefined,
  };
}
