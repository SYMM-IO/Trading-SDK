import Decimal from "decimal.js";
import { parseUnits } from "./parse-units";

/**
 * Convenience wrapper for `parseUnits(value, 18)`.
 *
 * @example
 * parseEther("2").toFixed(0);     // "2000000000000000000"
 * parseEther("0.002").toFixed(0); // "2000000000000000"
 */
export function parseEther(value: Decimal.Value): Decimal {
  return parseUnits(value, 18);
}
