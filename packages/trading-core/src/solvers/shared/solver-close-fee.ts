import { toDecimal } from "@symmio/utils/decimal";

/**
 * The close-fee rates a lowcap (Enigma) market charges, as flat fields matching
 * the `/symbols` wire names. Every {@link SolverSymbol} carries these, so a
 * symbol can be passed straight to {@link getSolverCloseFeeRate} /
 * {@link calculateSolverCloseFee}.
 *
 * The solver charges more to close a freshly opened position: the rate starts
 * at `hedgerFeeCloseEarlyRate`, holds flat until `hedgerFeeCloseEarlyThreshold`
 * seconds, then decays linearly to the standard `hedgerFeeClose` by
 * `hedgerFeeCloseStandardThreshold`. A market with no decay (a non-Enigma
 * solver, or one omitting the early fields) has `hedgerFeeCloseEarlyRate` equal
 * to `hedgerFeeClose` and both thresholds `0`.
 */
export interface SolverCloseFeeRates {
  /** Standard (floor) close-fee rate, decimal fraction string (e.g. `"0.0006"`). Wire: `hedger_fee_close`. */
  hedgerFeeClose: string;
  /** Early (peak) close-fee rate, decimal fraction string (e.g. `"0.0024"`). Wire: `hedger_fee_close_early_rate`. */
  hedgerFeeCloseEarlyRate: string;
  /** Seconds from open during which the early rate applies flat. Wire: `hedger_fee_close_early_threshold`. */
  hedgerFeeCloseEarlyThreshold: number;
  /** Seconds from open at/after which the standard rate applies; linear between the thresholds. Wire: `hedger_fee_close_standard_threshold`. */
  hedgerFeeCloseStandardThreshold: number;
}

/**
 * The solver close-fee **rate** for a lowcap position held `holdingSeconds`
 * since it opened.
 *
 * Piecewise over the holding age `t`:
 *
 * - `t ≤ hedgerFeeCloseEarlyThreshold` → `hedgerFeeCloseEarlyRate` (flat peak);
 * - `t ≥ hedgerFeeCloseStandardThreshold` → `hedgerFeeClose` (flat floor);
 * - in between → linear interpolation from the early rate down to the floor.
 *
 * With the staging numbers (`hedgerFeeCloseEarlyRate: "0.0024"`,
 * `hedgerFeeClose: "0.0006"`, thresholds `30` / `180`): a close at 30s pays
 * `0.0024`, at 105s pays the midpoint `0.0015`, and at 180s pays `0.0006`. A
 * negative `holdingSeconds` (clock skew on a just-opened position) is clamped
 * to `0`, so it prices at the peak. When no decay is defined — an unusable
 * early rate, or `hedgerFeeCloseStandardThreshold ≤ hedgerFeeCloseEarlyThreshold`
 * — the rate steps from the early rate straight to the floor.
 *
 * A {@link SolverSymbol} satisfies the `fees` parameter, so call it directly:
 * `getSolverCloseFeeRate(symbol, holdingSeconds)`.
 *
 * @returns The close-fee rate as a decimal fraction string.
 */
export function getSolverCloseFeeRate(fees: SolverCloseFeeRates, holdingSeconds: number): string {
  const early = toDecimal(fees.hedgerFeeCloseEarlyRate);
  const close = toDecimal(fees.hedgerFeeClose);
  const usableEarly = !early.isNaN() && !early.isNegative();
  const usableClose = !close.isNaN() && !close.isNegative();

  // No usable early rate → there is no decay to price; the standard rate stands
  // (and `"0"` only if that is unusable too, matching the pre-schedule default).
  if (!usableEarly) return usableClose ? close.toString() : "0";
  if (!usableClose) return early.toString();

  const t = Math.max(0, holdingSeconds);
  const earlyT = fees.hedgerFeeCloseEarlyThreshold;
  const standardT = fees.hedgerFeeCloseStandardThreshold;

  if (t <= earlyT) return early.toString();
  // Non-increasing thresholds leave no interpolation window: step to the floor.
  if (standardT <= earlyT || t >= standardT) return close.toString();

  const progress = toDecimal(t - earlyT).div(standardT - earlyT);
  return early.plus(close.minus(early).times(progress)).toString();
}

/**
 * The solver close-fee **amount** for a lowcap position:
 * `getSolverCloseFeeRate(fees, holdingSeconds) × notional`.
 *
 * Use this to price a close: with the position's `createTimestamp`, pass
 * `holdingSeconds = now − createTimestamp` to get the fee the solver charges
 * right now. Pass `holdingSeconds = 0` for the worst case (a just-opened
 * position), which is what an open must provision.
 *
 * @returns The close fee as a decimal string; `"0"` when `notional` is
 *   NaN/absent or negative.
 *
 * @example
 * ```ts
 * const fee = calculateSolverCloseFee(symbol, { notional: "1000", holdingSeconds: 0 });
 * // "2.4" with staging hedgerFeeCloseEarlyRate 0.0024
 * ```
 */
export function calculateSolverCloseFee(
  fees: SolverCloseFeeRates,
  params: { notional: string; holdingSeconds: number },
): string {
  const notional = toDecimal(params.notional);
  if (notional.isNaN() || notional.isNegative()) return "0";
  const rate = toDecimal(getSolverCloseFeeRate(fees, params.holdingSeconds));
  if (rate.isNaN()) return "0";
  return notional.times(rate).toString();
}

/**
 * Coerce a solver's whole-seconds threshold value (a wire string, a number, or
 * absent) to a non-negative finite number, defaulting to `0`. Used when mapping
 * raw `/symbols` rows onto {@link SolverCloseFeeRates}' threshold fields.
 */
export function toThresholdSeconds(value: string | number | undefined): number {
  const seconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
}
