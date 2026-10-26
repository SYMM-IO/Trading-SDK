import type { MarketInfo } from "../../solvers/market-info/types";
import type { MarketNotionalCap } from "../../solvers/notional-cap/types";
import { units, type PoolReadGap } from "../composition";
import type { ListingMarket, ListingMarketDetail, PoolRewardPoint, PoolTransaction, UserPoolProfit } from "../types";

/** Normalized inputs to the statistics projection; failed reads stay null. */
export interface CalculatePoolStatisticsParameters {
  /** Optional existing catalog snapshot; no additional search request is needed. */
  listing?: ListingMarket | null;
  detail: ListingMarketDetail | null;
  pending: readonly PoolTransaction[] | null;
  rewards: readonly PoolRewardPoint[] | null;
  notionalCap: MarketNotionalCap | null;
  marketInfo: MarketInfo | null;
  scope?: "pool" | "user";
  profit?: UserPoolProfit | null;
  priceUsd?: number;
  gaps?: readonly PoolReadGap[];
}

/** Project a statistics card from SDK reads without transport or UI assumptions.
 * @param input - Detail, pending withdrawals, rewards, solver sources and optional user stake.
 * @returns Unformatted statistics with null for unavailable values. Token amounts remain bigint.
 */
export function calculatePoolStatistics(input: CalculatePoolStatisticsParameters) {
  const { detail, profit } = input;
  const rawRatio =
    input.scope !== "user"
      ? 10n ** 18n
      : profit && detail && detail.totalUsdcInPool > 0n
        ? (profit.userBalanceInUsdc * 10n ** 18n) / detail.totalUsdcInPool
        : null;
  const ratio = rawRatio == null ? null : rawRatio > 10n ** 18n ? 10n ** 18n : rawRatio < 0n ? 0n : rawRatio;
  const scale = (amount: bigint | null | undefined) =>
    amount == null || ratio == null
      ? null
      : (amount * (ratio > 10n ** 18n ? 10n ** 18n : ratio < 0n ? 0n : ratio)) / 10n ** 18n;
  const tokenAmount = scale(detail?.reportedTotalTokenInPool);
  const usdcAmount = scale(detail?.reportedTotalUsdcInPool);
  const tvl = units(scale(input.listing?.tvl ?? detail?.tvl));
  const balanceTvl = units(scale(detail?.tvl));
  const tokenUsdValue = balanceTvl == null || usdcAmount == null ? null : Math.max(0, balanceTvl - units(usdcAmount)!);
  const priceUsd =
    tokenAmount != null && tokenAmount > 0n && tokenUsdValue != null
      ? tokenUsdValue / units(tokenAmount)!
      : (input.priceUsd ?? null);
  const pendingRows =
    input.scope === "user" || input.pending == null
      ? null
      : input.pending.filter((row) => row.type === "withdraw" && row.status === "pending");
  const pendingToken =
    pendingRows == null || pendingRows.some((row) => row.tokenAmount == null)
      ? null
      : pendingRows.reduce((sum, row) => sum + row.tokenAmount!, 0n);
  const pendingUsdc =
    pendingRows == null || pendingRows.some((row) => row.usdcAmount == null)
      ? null
      : pendingRows.reduce((sum, row) => sum + row.usdcAmount!, 0n);
  const pendingUsd =
    pendingToken == null || pendingUsdc == null || (pendingToken > 0n && priceUsd == null)
      ? null
      : units(pendingUsdc)! + units(pendingToken)! * (priceUsd ?? 0);
  const latestReward = input.rewards?.reduce<PoolRewardPoint | null>(
    (latest, row) => (!latest || row.timestamp > latest.timestamp ? row : latest),
    null,
  );
  const volume =
    input.marketInfo?.kind === "enigma"
      ? input.marketInfo.markets.find((row) => row.symbolId === detail?.symbolId)
      : undefined;
  const cap = input.notionalCap?.kind === "enigma" && !input.notionalCap.error ? input.notionalCap : null;
  const scaleNumber = (value: number | null | undefined) =>
    value == null || ratio == null ? null : (value * Number(ratio)) / 1e18;
  return {
    tvl,
    tokenAmount,
    usdcAmount,
    tokenUsdValue,
    priceUsd,
    pendingToken,
    pendingUsdc,
    pendingUsd,
    pendingCount: pendingRows?.length ?? null,
    tokenPercent:
      balanceTvl != null && balanceTvl > 0 && tokenUsdValue != null ? (tokenUsdValue / balanceTvl) * 100 : null,
    tvlAfterPending: tvl == null || pendingUsd == null ? null : Math.max(0, tvl - pendingUsd),
    tokenAfterPending:
      tokenAmount == null || pendingToken == null ? null : tokenAmount > pendingToken ? tokenAmount - pendingToken : 0n,
    openInterest: units(scale(input.listing?.openInterest)) ?? scaleNumber(cap?.used),
    availableLong: cap?.availableToLong ?? null,
    availableShort: cap?.availableToShort ?? null,
    volume24h: scaleNumber(volume?.tradingVolume) ?? units(scale(input.listing?.vol24h)),
    lifetimeVolume: scaleNumber(volume?.lifetimeValue),
    apy30d: units(input.listing?.aprByWindow.d30 ?? input.listing?.apr ?? input.listing?.apy30d ?? detail?.apy.d30),
    apyLifetime: units(input.listing?.apyLifetime ?? detail?.apy.lifetime),
    rewards24h: units(scale(latestReward?.reward ?? detail?.rewards.h24)),
    rewards30d: units(scale(detail?.rewards.d30)),
    lifetimeRewards: units(scale(detail?.rewards.lifetime)),
    maintenanceTotal: units(scale(detail?.reportedMaintenanceFees)),
    buybackRatio: detail?.buybackRatio ?? null,
    maxLeverage: detail?.maxLeverage ?? null,
    gaps: [...(input.gaps ?? [])],
  };
}
/** Flat statistics result, with raw amounts and human-unit USD/percentages. */
export type PoolStatistics = ReturnType<typeof calculatePoolStatistics>;
