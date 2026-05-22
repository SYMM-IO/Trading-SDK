import Decimal from "decimal.js";
import { formatUnits } from "./format-units";

/**
 * Convenience wrapper for `formatUnits(value, 18)`.
 *
 * @example
 * formatEther("2000000000000000000").toString(); // "2"
 * formatEther("2000000000000000").toString();    // "0.002"
 */
export function formatEther(value?: Decimal.Value): Decimal {
  return formatUnits(value, 18);
}
