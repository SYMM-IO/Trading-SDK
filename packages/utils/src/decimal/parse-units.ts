import Decimal from "decimal.js";
import { toDecimal } from "./to-decimal";

/**
 * Convert a human-readable amount into its fixed-point integer form as a
 * `Decimal`. Counterpart to {@link formatUnits} — use the result as a
 * `Decimal` for further math, or `.toFixed(0)` to get the integer string an
 * on-chain call expects.
 *
 * `decimals` defaults to 18 (typical ERC-20).
 *
 * @example
 * parseUnits("1", 18).toFixed(0);   // "1000000000000000000"
 * parseUnits("1.23", 6).toFixed(0); // "1230000"
 */
export function parseUnits(value: Decimal.Value, decimals: number = 18): Decimal {
  return toDecimal(value).mul(new Decimal(10).pow(decimals));
}
