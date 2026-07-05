/** Seconds in one day — converts a day-count into a span of funding epochs. */
const SECONDS_PER_DAY = 86_400;

/** Parameters for {@link projectFundingRate}. */
export interface ProjectFundingRateParameters {
  /** Per-epoch funding rate as a decimal fraction (e.g. `MarketFundingInfo.nextFundingRateLong`). */
  ratePerEpoch: number;
  /** Funding epoch length in seconds (e.g. `MarketFundingInfo.epochDurationSeconds`). */
  epochDurationSeconds: number;
  /** Projection window in days (fractional allowed). */
  days: number;
}

/**
 * Project a per-epoch funding rate over a number of days by **linear
 * (non-compounded)** extrapolation — the same method the reference frontend
 * uses for its 1D / yearly figures: multiply the per-epoch rate by how many
 * funding epochs elapse in the window (`days × 86_400 / epochDurationSeconds`).
 *
 * The result keeps the input's unit — a decimal fraction, as returned on
 * {@link MarketFundingInfo} (multiply by 100 for a percentage). It is **not**
 * APR-compounded.
 *
 * @param params - The per-epoch rate, the epoch length, and the day window.
 * @returns The projected funding rate over `days`; `0` when `epochDurationSeconds`
 *   is non-positive (no epochs accrue).
 *
 * @example
 * // 12h epoch (2 epochs/day). Per-epoch -0.0003014 over 30 days:
 * projectFundingRate({ ratePerEpoch: -0.0003014, epochDurationSeconds: 43_200, days: 30 });
 * // → -0.0180858  (≈ -1.81%)
 */
export function projectFundingRate({ ratePerEpoch, epochDurationSeconds, days }: ProjectFundingRateParameters): number {
  if (epochDurationSeconds <= 0) return 0;
  const epochsInWindow = (days * SECONDS_PER_DAY) / epochDurationSeconds;
  return ratePerEpoch * epochsInWindow;
}
