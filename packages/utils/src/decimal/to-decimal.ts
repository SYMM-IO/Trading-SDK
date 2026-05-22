import Decimal from "decimal.js";
import { isEmpty, isNil } from "ramda";
import { ZERO_DECIMAL } from "./config";

/**
 * Convert any `Decimal.Value` (string, number, bigint, Decimal) into a
 * `Decimal` instance. Nullish or empty-string inputs become `ZERO_DECIMAL`,
 * so callers can pass user-typed strings directly without a guard.
 *
 * @example
 * toDecimal("1.234").toFixed();     // "1.234"
 * toDecimal(undefined).toString();  // "0"
 * toDecimal("").toString();         // "0"
 */
export function toDecimal(value?: Decimal.Value | null): Decimal {
  if (isNil(value) || isEmpty(value)) return ZERO_DECIMAL;
  return new Decimal(value);
}
