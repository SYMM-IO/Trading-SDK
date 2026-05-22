import Decimal from "decimal.js";
import { toDecimal } from "./to-decimal";

/**
 * Convert a fixed-point integer (e.g. wei) into a human-readable `Decimal`.
 *
 * The Decimal return is the key difference from viem's `formatUnits` (which
 * returns a `string`): a `Decimal` is chainable for UI math without round-trip
 * parsing. Use viem's version when you need the raw display string; use this
 * one when you want to multiply, divide, or compare the result.
 *
 * `decimals` defaults to 18 (typical ERC-20).
 *
 * @example
 * formatUnits("1000000000000000000", 18).toString(); // "1"
 * formatUnits(1230000, 6).toString();                // "1.23"
 * formatUnits(undefined, 18).toString();             // "0"
 */
export function formatUnits(value?: Decimal.Value, decimals: number = 18): Decimal {
  return toDecimal(value).div(new Decimal(10).pow(decimals));
}
