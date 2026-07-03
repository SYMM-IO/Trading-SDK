import { WEI } from "../../shared/utils/wei";

/**
 * Inputs for {@link calculateOpenPlatformFee}. All bigint fields are 18-decimal wei.
 */
export interface CalculateOpenPlatformFeeInputs {
  /** Quote quantity (wei). */
  quantity: bigint;
  /** Price the position opened at (wei). */
  openedPrice: bigint;
  /** Open-side trading-fee rate baked into the quote (wei). */
  openFeeRate: bigint;
}

/**
 * Open-side platform fee for a quote, in 18-decimal-wei collateral units.
 *
 * `openPlatformFee = quantity × openedPrice × openFeeRate / 1e36`
 *
 * Each factor is 18-decimal wei, so the product scales by `1e54`; dividing by
 * `1e36` brings the result back to 18-decimal wei. All math is pure `bigint`, so
 * there is no floating-point drift.
 *
 * @example
 * ```ts
 * const openFee = calculateOpenPlatformFee({
 *   quantity: 294_184_204_000_000_000_000n,
 *   openedPrice: 8_488_760_477_144_112n,
 *   openFeeRate: 120_000_000_000_000n,
 * });
 * ```
 */
export function calculateOpenPlatformFee(inputs: CalculateOpenPlatformFeeInputs): bigint {
  return (inputs.quantity * inputs.openedPrice * inputs.openFeeRate) / (WEI * WEI);
}
