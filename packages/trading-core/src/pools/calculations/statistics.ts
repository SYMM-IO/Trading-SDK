import { scalePoolAmountByShare } from "./balance";
import { parsePoolMetric, parsePoolPercent, parseScaledPoolMetric, type PoolMetricValue } from "./metrics";

/** Pending withdrawals in unscaled token and collateral units. */
export interface PoolPendingWithdrawalTotals {
  count: number;
  tokenAmount: number;
  usdcAmount: number;
}

/** Sum accepted, unsettled withdrawals; deposits and terminal rows never contribute. */
export function sumPoolPendingWithdrawals(
  rows: readonly { type: string; status: string; tokenAmount?: PoolMetricValue; usdcAmount?: PoolMetricValue }[],
): PoolPendingWithdrawalTotals {
  return rows.reduce(
    (total, row) =>
      row.type !== "withdraw" || row.status !== "pending"
        ? total
        : {
            count: total.count + 1,
            tokenAmount: total.tokenAmount + (parseScaledPoolMetric(row.tokenAmount) ?? 0),
            usdcAmount: total.usdcAmount + (parseScaledPoolMetric(row.usdcAmount) ?? 0),
          },
    { count: 0, tokenAmount: 0, usdcAmount: 0 },
  );
}

/** Price the two pending legs; missing token prices contribute only the collateral leg. */
export function getPoolPendingWithdrawalUsd(
  pending: PoolPendingWithdrawalTotals,
  priceUsd: number | null | undefined,
): number {
  return pending.tokenAmount * (priceUsd ?? 0) + pending.usdcAmount;
}

/** Optional listing snapshot fields. Amounts are raw 18-decimal strings; rates may be plain or scaled. */
export interface PoolStatisticsSnapshot {
  tvl?: PoolMetricValue;
  openInterest?: PoolMetricValue;
  volume24h?: PoolMetricValue;
  apr30d?: PoolMetricValue;
  apr?: PoolMetricValue;
  apy30d?: PoolMetricValue;
  apyLifetime?: PoolMetricValue;
  reward24h?: PoolMetricValue;
  reward30d?: PoolMetricValue;
  rewardLifetime?: PoolMetricValue;
}

/** Detail snapshot. Financial amounts and APYs are raw 18-decimal values. */
export interface PoolStatisticsDetail extends PoolStatisticsSnapshot {
  totalToken?: PoolMetricValue;
  totalUsdc?: PoolMetricValue;
  maintenanceFees?: PoolMetricValue;
  legacyLifetimeReward?: PoolMetricValue;
  buybackRatio?: PoolMetricValue;
  maxLeverage?: number;
}

/** Inputs for consistent statistics across summary and detail surfaces. */
export interface GetPoolStatisticsParameters {
  listing?: PoolStatisticsSnapshot;
  detail?: PoolStatisticsDetail;
  poolApy30d?: PoolMetricValue;
  poolBuybackRatio?: PoolMetricValue;
  poolMaxLeverage?: number;
  priceUsd?: number;
  notionalUsed?: PoolMetricValue;
  availableLong?: PoolMetricValue;
  availableShort?: PoolMetricValue;
  hedgerVolume24h?: PoolMetricValue;
  hedgerLifetimeVolume?: number;
  rewards?: readonly { timestamp: number; reward: PoolMetricValue }[];
  /** 1 for the pool, the LP fraction for ownership views, null for unknown ownership. */
  shareFraction: number | null;
  /** Omit in an ownership view: the pool queue belongs to individual withdrawing LPs. */
  pending?: PoolPendingWithdrawalTotals | null;
}

/** Select sources and derive unformatted pool statistics. TVL split and pending valuation use one detail snapshot. */
export function getPoolStatistics(input: GetPoolStatisticsParameters) {
  const { listing, detail, pending } = input;
  const scale = (value: number | null | undefined) => scalePoolAmountByShare(value, input.shareFraction);
  const oi = parseScaledPoolMetric(listing?.openInterest) ?? parsePoolMetric(input.notionalUsed);
  const tvl = scale(parseScaledPoolMetric(listing?.tvl) ?? parseScaledPoolMetric(detail?.tvl));
  const latestReward = input.rewards?.reduce<NonNullable<typeof input.rewards>[number] | undefined>(
    (latest, point) => (!latest || point.timestamp > latest.timestamp ? point : latest),
    undefined,
  );
  const tokenAmount = scale(parseScaledPoolMetric(detail?.totalToken)) ?? undefined;
  const usdcAmount = scale(parseScaledPoolMetric(detail?.totalUsdc)) ?? undefined;
  const balanceTvl = scale(parseScaledPoolMetric(detail?.tvl));
  const tokenUsdValue = balanceTvl != null && usdcAmount != null ? Math.max(balanceTvl - usdcAmount, 0) : undefined;
  const impliedTokenPrice =
    tokenAmount != null && tokenAmount > 0 && tokenUsdValue != null ? tokenUsdValue / tokenAmount : input.priceUsd;
  const pendingValue = pending ? getPoolPendingWithdrawalUsd(pending, impliedTokenPrice) : null;
  const pendingUsd = pendingValue != null && Number.isFinite(pendingValue) ? pendingValue : null;
  const tokenAfterPending = pending && tokenAmount != null ? Math.max(tokenAmount - pending.tokenAmount, 0) : null;
  const totalUsd = tokenUsdValue != null && usdcAmount != null ? tokenUsdValue + usdcAmount : undefined;
  return {
    tvl,
    openInterest: scale(oi == null ? null : Math.max(oi, 0)),
    availableLong: input.availableLong == null ? undefined : Math.max(parsePoolMetric(input.availableLong) ?? 0, 0),
    availableShort: input.availableShort == null ? undefined : Math.max(parsePoolMetric(input.availableShort) ?? 0, 0),
    volume24h: scale(parsePoolMetric(input.hedgerVolume24h) ?? parseScaledPoolMetric(listing?.volume24h)),
    lifetimeVolume: scale(input.hedgerLifetimeVolume),
    apy30d: parsePoolPercent(
      listing?.apr30d ?? listing?.apr ?? input.poolApy30d ?? listing?.apy30d ?? parseScaledPoolMetric(detail?.apy30d),
    ),
    apyLifetime: parsePoolPercent(listing?.apyLifetime) ?? parseScaledPoolMetric(detail?.apyLifetime),
    rewards24h: scale(
      parseScaledPoolMetric(latestReward?.reward) ??
        parseScaledPoolMetric(detail?.reward24h) ??
        parseScaledPoolMetric(listing?.reward24h),
    ),
    rewards30d: scale(parseScaledPoolMetric(detail?.reward30d) ?? parseScaledPoolMetric(listing?.reward30d)),
    lifetimeRewards: scale(
      parseScaledPoolMetric(detail?.rewardLifetime) ??
        parseScaledPoolMetric(listing?.rewardLifetime) ??
        parsePoolMetric(detail?.legacyLifetimeReward),
    ),
    buybackRatio: detail?.buybackRatio ?? input.poolBuybackRatio,
    maxLeverage:
      input.poolMaxLeverage != null && input.poolMaxLeverage > 0 ? input.poolMaxLeverage : detail?.maxLeverage,
    maintenanceTotal: scale(parseScaledPoolMetric(detail?.maintenanceFees)),
    tokenAmount,
    usdcAmount,
    tokenUsdValue,
    impliedTokenPrice,
    pendingUsd,
    tokenAfterPending,
    totalUsd,
    tokenAfterPendingUsd: tokenAfterPending == null ? null : tokenAfterPending * (impliedTokenPrice ?? 0),
    tvlAfterPending: pendingUsd == null ? null : Math.max((tvl ?? 0) - pendingUsd, 0),
    tokenPercent: totalUsd != null && totalUsd > 0 && tokenUsdValue != null ? (tokenUsdValue / totalUsd) * 100 : 50,
  };
}
