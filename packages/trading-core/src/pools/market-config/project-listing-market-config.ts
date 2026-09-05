import type { ListingMarketConfigProjection, ProjectListingMarketConfigParameters } from "./types";

/** Scale used to divide two 18-decimal `bigint`s into a JS number ratio. */
const RATIO_PRECISION = 1_000_000n;

/**
 * Divide two 18-decimal `bigint`s into a `number` ratio without losing the
 * fraction to integer division. Returns `0` when the denominator is not
 * positive.
 */
function ratio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return 0;

  return Number((numerator * RATIO_PRECISION) / denominator) / Number(RATIO_PRECISION);
}

/** Clamp a number into `0..1`, mapping a non-finite value to `0`. */
function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(1, Math.max(0, value));
}

/**
 * Estimate where a pool's configuration lands once the caller's opinion is
 * saved, without waiting for the round trip.
 *
 * The service blends every LP's opinion by deposit weight, so the caller's
 * opinion moves the pool by their share of it. The pool already folds in the
 * caller's **previous** opinion at that same weight, so replacing it shifts the
 * pool by `share * (entered - prior)` — exact to first order. When the caller
 * has never configured the market (`prior` is `null`) the pool value itself is
 * used as the baseline, which makes the result an approximation.
 *
 * The weight is a deposit **value** share, not a raw token-count share. Part of
 * a pool's TVL is USDC — notably the one-time swap on a pool's first deposit —
 * and USDC carries no token-opinion weight, so the token-count share is scaled
 * by the token portion of TVL, `(tvl - usdc) / tvl`. On a mature pool USDC is
 * negligible and the scaling is a no-op; on a tiny pool, where the fixed swap is
 * a large fraction of TVL, it removes a real skew.
 *
 * Present the result as approximate. The service rounds the blend it stores, so
 * the exact figure is whatever `updateListingMarketConfig` returns.
 *
 * @param parameters - The pool values, the caller's prior opinion, the values being entered, and the caller's stake.
 * @returns The caller's {@link ListingMarketConfigProjection.share} and the projected pool values.
 *
 * @example
 * ```ts
 * const projection = projectListingMarketConfig({
 *   poolBuybackRatio: detail.buybackRatio,
 *   poolMaxLeverage: detail.maxLeverage,
 *   priorBuybackRatio: marketConfig.userBuybackRatio,
 *   priorMaxLeverage: marketConfig.userMaxLeverage,
 *   buybackRatio: 75,
 *   maxLeverage: 10,
 *   userTokenAmount: profit.userBalanceInTokens,
 *   totalTokenInPool: detail.totalTokenInPool,
 *   tvl: detail.tvl,
 *   totalUsdcInPool: detail.totalUsdcInPool,
 * });
 * // e.g. "~52.5%"
 * projection.projectedBuybackRatio;
 * ```
 */
export function projectListingMarketConfig(
  parameters: ProjectListingMarketConfigParameters,
): ListingMarketConfigProjection {
  const tokenShare = ratio(parameters.userTokenAmount, parameters.totalTokenInPool);
  const tvl = parameters.tvl ?? 0n;
  /**
   * The token portion of TVL. USDC in the pool is value that carries no
   * token-opinion weight, so it is removed from the share.
   */
  const tokenValueFraction = tvl > 0n ? Math.max(0, ratio(tvl - parameters.totalUsdcInPool, tvl)) : 0;
  const share = clampUnit(tokenShare * tokenValueFraction);

  const blend = (pool: number | null, prior: number | null, entered?: number): number | null => {
    if (pool === null || entered === undefined) return null;

    return pool + share * (entered - (prior ?? pool));
  };

  return {
    share,
    projectedBuybackRatio: blend(parameters.poolBuybackRatio, parameters.priorBuybackRatio, parameters.buybackRatio),
    projectedMaxLeverage: blend(parameters.poolMaxLeverage, parameters.priorMaxLeverage, parameters.maxLeverage),
  };
}
