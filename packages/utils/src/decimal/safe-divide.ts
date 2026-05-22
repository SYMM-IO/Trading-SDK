import Decimal from "decimal.js";
import { toDecimal } from "./to-decimal";

/**
 * Divide two `Decimal.Value`s, returning `0` when the divisor is nullish or
 * zero. Lets call sites compute ratios without guarding against divide-by-zero
 * at every callsite.
 *
 * @example
 * safeDivide(10, 2).toString();   // "5"
 * safeDivide(10, 0).toString();   // "0"
 * safeDivide(10, null).toString(); // "0"
 */
export function safeDivide(a: Decimal.Value, b?: Decimal.Value | null): Decimal {
  const divisor = toDecimal(b);
  if (divisor.isZero()) return toDecimal(0);
  return toDecimal(a).div(divisor);
}
