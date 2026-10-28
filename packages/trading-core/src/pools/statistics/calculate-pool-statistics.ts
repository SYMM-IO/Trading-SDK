import { toDecimal } from "@symmio/utils";
import { parseUnits } from "viem";
import type { EnigmaMarketInfo, MarketVolume, RasaMarketInfo } from "../../solvers/market-info/types";
import type { EnigmaNotionalCap, RasaNotionalCap } from "../../solvers/notional-cap/types";
import { units, type PoolReadGap } from "../composition";
import type { ListingMarket, ListingMarketDetail, PoolRewardPoint, PoolTransaction, UserPoolProfit } from "../types";

/** Normalized inputs to the statistics projection; failed reads stay null. */
export interface CalculatePoolStatisticsParameters {
  /** Optional existing catalog snapshot; no additional search request is needed. */
  listing?: Partial<ListingMarket> | null;
  detail: Partial<ListingMarketDetail> | null;
  pending: readonly Pick<PoolTransaction, "type" | "status" | "tokenAmount" | "usdcAmount">[] | null;
  rewards: readonly PoolRewardPoint[] | null;
  notionalCap: (Pick<EnigmaNotionalCap, "kind"> & Partial<Omit<EnigmaNotionalCap, "kind">>) | RasaNotionalCap | null;
  marketInfo:
    | (Pick<EnigmaMarketInfo, "kind"> & {
        markets: readonly (Pick<MarketVolume, "symbolId"> & Partial<Omit<MarketVolume, "symbolId">>)[];
      })
    | RasaMarketInfo
    | null;
  scope?: "pool" | "user";
  profit?: UserPoolProfit | null;
  priceUsd?: number;
  /** Explicit LP fraction; null means unknown. Omission derives it from profit/detail. */
  shareFraction?: number | null;
  /** Already aggregated pending queue, in 18-decimal units. Never used for user scope. */
  pendingTotals?: { count: number; tokenAmount: bigint | null; usdcAmount: bigint | null } | null;
  /** Normalized whole-percent rate from an existing pool snapshot. */
  apy30dFallback?: bigint | null;
  buybackRatioFallback?: number | null;
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
      : input.shareFraction !== undefined
        ? input.shareFraction == null || !Number.isFinite(input.shareFraction)
          ? null
          : parseUnits(toDecimal(Math.min(1, Math.max(0, input.shareFraction))).toFixed(), 18)
        : profit && (profit.totalUsdcInPool ?? detail?.totalUsdcInPool ?? 0n) > 0n
          ? (profit.userBalanceInUsdc * 10n ** 18n) / (profit.totalUsdcInPool ?? detail!.totalUsdcInPool!)
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
      : input.priceUsd != null && Number.isFinite(input.priceUsd) && input.priceUsd >= 0
        ? input.priceUsd
        : null;
  const pendingRows =
    input.scope === "user" || input.pending == null
      ? null
      : input.pending.filter((row) => row.type === "withdraw" && row.status === "pending");
  const pendingTotals = input.scope === "user" ? null : input.pendingTotals;
  const pendingToken = pendingTotals
    ? pendingTotals.tokenAmount
    : pendingRows == null || pendingRows.some((row) => row.tokenAmount == null)
      ? null
      : pendingRows.reduce((sum, row) => sum + row.tokenAmount!, 0n);
  const pendingUsdc = pendingTotals
    ? pendingTotals.usdcAmount
    : pendingRows == null || pendingRows.some((row) => row.usdcAmount == null)
      ? null
      : pendingRows.reduce((sum, row) => sum + row.usdcAmount!, 0n);
  const pendingUsd =
    pendingToken == null || pendingUsdc == null ? null : units(pendingUsdc)! + units(pendingToken)! * (priceUsd ?? 0);
  const latestReward = input.rewards?.reduce<PoolRewardPoint | null>(
    (latest, row) => (!latest || row.timestamp > latest.timestamp ? row : latest),
    null,
  );
  const volume =
    input.marketInfo?.kind === "enigma"
      ? input.marketInfo.markets.find((row) => row.symbolId === (detail?.symbolId ?? input.listing?.symbolId))
      : undefined;
  const cap = input.notionalCap?.kind === "enigma" && !input.notionalCap.error ? input.notionalCap : null;
  const scaleNumber = (value: number | null | undefined) =>
    value == null || ratio == null ? null : (value * Number(ratio)) / 1e18;
  const tokenAfterPending =
    tokenAmount == null || pendingToken == null ? null : tokenAmount > pendingToken ? tokenAmount - pendingToken : 0n;
  const totalUsd = tokenUsdValue == null || usdcAmount == null ? null : tokenUsdValue + units(usdcAmount)!;
  const openInterest = units(input.listing?.openInterest) ?? cap?.used;
  const legacyReward =
    detail?.legacyLifetimeReward == null || detail.legacyLifetimeReward.trim() === ""
      ? null
      : Number(detail.legacyLifetimeReward);
  return {
    tvl,
    tokenAmount,
    usdcAmount,
    tokenUsdValue,
    priceUsd,
    pendingToken,
    pendingUsdc,
    pendingUsd,
    pendingCount: pendingTotals?.count ?? pendingRows?.length ?? null,
    totalUsd,
    tokenAfterPendingUsd: tokenAfterPending == null ? null : units(tokenAfterPending)! * (priceUsd ?? 0),
    pendingValuationComplete: pendingToken != null && pendingUsdc != null && (pendingToken === 0n || priceUsd != null),
    tokenPercent: totalUsd != null && totalUsd > 0 && tokenUsdValue != null ? (tokenUsdValue / totalUsd) * 100 : null,
    tvlAfterPending: tvl == null || pendingUsd == null ? null : Math.max(0, tvl - pendingUsd),
    tokenAfterPending,
    openInterest: scaleNumber(openInterest == null ? null : Math.max(openInterest, 0)),
    availableLong: cap?.availableToLong == null ? null : Math.max(0, cap.availableToLong),
    availableShort: cap?.availableToShort == null ? null : Math.max(0, cap.availableToShort),
    volume24h: scaleNumber(volume?.tradingVolume) ?? units(scale(input.listing?.vol24h)),
    lifetimeVolume: scaleNumber(volume?.lifetimeValue),
    apy30d: units(
      input.listing?.aprByWindow?.d30 ??
        input.listing?.apr ??
        input.apy30dFallback ??
        input.listing?.apy30d ??
        detail?.apy?.d30,
    ),
    apyLifetime: units(input.listing?.apyLifetime ?? detail?.apy?.lifetime),
    rewards24h: units(scale(latestReward?.reward ?? detail?.rewards?.h24 ?? input.listing?.reward24h)),
    rewards30d: units(scale(detail?.rewards?.d30 ?? input.listing?.reward30d)),
    lifetimeRewards:
      units(scale(detail?.rewards?.lifetime ?? input.listing?.rewardLifetime)) ??
      scaleNumber(legacyReward != null && Number.isFinite(legacyReward) ? legacyReward : null),
    maintenanceTotal: units(scale(detail?.reportedMaintenanceFees)),
    buybackRatio: detail?.buybackRatio ?? input.buybackRatioFallback ?? null,
    maxLeverage:
      input.listing?.maxLeverage != null && input.listing.maxLeverage > 0
        ? input.listing.maxLeverage
        : (detail?.maxLeverage ?? null),
    gaps: [...(input.gaps ?? [])],
  };
}
/** Flat statistics result, with raw amounts and human-unit USD/percentages. */
export type PoolStatistics = ReturnType<typeof calculatePoolStatistics>;
