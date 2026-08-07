import { toDecimal } from "@symmio/utils/decimal";
import { PositionType } from "../symmio-contracts/symmio/types";

/**
 * Default slippage percent applied when deriving the conditional order's
 * "opened" price for lowcap markets. The handler quotes against a very wide
 * tolerance — 90 percent — so the SDK mirrors that as the default unless the
 * caller overrides it.
 */
export const DEFAULT_TPSL_SLIPPAGE_LOWCAPS = 90;

/**
 * Shift a trigger price by `slippage` percent in the direction the conditional
 * order would fill at. Used to derive the `price` field on each
 * {@link TpSlConditionalOrderLeg}.
 *
 * - `SHORT`: shifts up by `1 + slippage/100`.
 * - `LONG`:  shifts down by `1 − slippage/100`.
 *
 * The result is rounded to `pricePrecision` decimals to match the market.
 *
 * @example
 * ```ts
 * priceSlippageCalculation("100", 90, PositionType.LONG, 4); // "10.0000"
 * ```
 */
export function priceSlippageCalculation(
  price: string,
  slippage: number,
  positionType: PositionType,
  pricePrecision: number,
): string {
  const factor = positionType === PositionType.SHORT ? 1 + slippage / 100 : 1 - slippage / 100;
  return toDecimal(price).times(factor).toFixed(pricePrecision);
}
