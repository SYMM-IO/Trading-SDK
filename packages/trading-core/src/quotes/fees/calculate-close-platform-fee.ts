import { WEI } from "../../shared/utils/wei";

/**
 * Inputs for {@link calculateClosePlatformFee}. All bigint fields are 18-decimal wei.
 */
export interface CalculateClosePlatformFeeInputs {
  /** Closed quantity (wei). */
  quantity: bigint;
  /** Average price the position closed at (wei). */
  closePrice: bigint;
  /** Close-side fee rate baked into the quote (wei). */
  closeFeeRate: bigint;
}

/**
 * Close-side platform fee for a quote, in 18-decimal-wei collateral units.
 *
 * `closePlatformFee = quantity × closePrice × closeFeeRate / 1e36`
 *
 * Each factor is 18-decimal wei, so the product scales by `1e54`; dividing by
 * `1e36` brings the result back to 18-decimal wei. All math is pure `bigint`, so
 * there is no floating-point drift.
 *
 * @example
 * ```ts
 * const closeFee = calculateClosePlatformFee({
 *   quantity: 100_000_000_000_000_000_000n,
 *   closePrice: 8_838_000_000_000_000n,
 *   closeFeeRate: 120_000_000_000_000n,
 * });
 * ```
 */
export function calculateClosePlatformFee(inputs: CalculateClosePlatformFeeInputs): bigint {
  return (inputs.quantity * inputs.closePrice * inputs.closeFeeRate) / (WEI * WEI);
}
