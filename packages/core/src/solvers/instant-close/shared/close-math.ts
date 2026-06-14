import { RoundingMode, toDecimal } from "@symm-frontier/utils/decimal";
import { PositionType } from "./types";

/**
 * Parameters for {@link calculateClosePrice}.
 */
export interface CalculateClosePriceParameters {
  /** Current mark price as decimal string. */
  markPrice: string;
  /** Slippage percent (e.g. `5` for 5%). */
  slippage: number;
  /** Side of the position being closed (LONG = selling, SHORT = buying). */
  positionType: PositionType;
  /** Price precision (decimals). */
  pricePrecision: number;
}

/**
 * Compute the slippage-adjusted close price for a MARKET close.
 *
 * - **LONG close** = selling. Worst fill is a *lower* price, so the user
 *   accepts `markPrice × (1 − s)`.
 * - **SHORT close** = buying. Worst fill is a *higher* price, so the user
 *   accepts `markPrice × (1 + s)`.
 *
 * Result is rounded *down* to `pricePrecision` (matches the open-side
 * `calculateTradeParams` rounding so the contract-side encoding never sees a
 * value with too many fractional digits).
 *
 * @returns Close price as a decimal string, or `null` when `markPrice` is
 *   zero/NaN.
 */
export function calculateClosePrice(parameters: CalculateClosePriceParameters): string | null {
  const markPriceDec = toDecimal(parameters.markPrice);
  if (markPriceDec.isZero() || markPriceDec.isNaN()) return null;

  // LONG close → sell at lower; SHORT close → buy at higher.
  const signedSlippage = parameters.positionType === PositionType.LONG ? -parameters.slippage : parameters.slippage;
  const slippageFactor = toDecimal(100 + signedSlippage).div(100);
  return markPriceDec.times(slippageFactor).toFixed(parameters.pricePrecision, RoundingMode.ROUND_DOWN);
}

/**
 * Parameters for {@link clampClosePrecision}.
 */
export interface ClampClosePrecisionParameters {
  /** Quantity to close as decimal string. */
  quantityToClose: string;
  /** Quantity precision (decimals). */
  quantityPrecision: number;
}

/**
 * Trim a user-entered close quantity to the market's `quantityPrecision`,
 * rounded down so the on-chain encoding stays within the allowed digits.
 *
 * @returns Quantity as a decimal string, or `null` when the input is invalid.
 */
export function clampClosePrecision(parameters: ClampClosePrecisionParameters): string | null {
  const quantityDec = toDecimal(parameters.quantityToClose);
  if (quantityDec.isNaN() || quantityDec.lte(0)) return null;
  return quantityDec.toFixed(parameters.quantityPrecision, RoundingMode.ROUND_DOWN);
}
