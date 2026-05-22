import Decimal from "decimal.js";
import { toDecimal } from "../decimal/to-decimal";
import { formatWithCommas, type FormatWithCommasOptions } from "./format-with-commas";

/**
 * Options for {@link formatPercentage}.
 */
export interface FormatPercentageOptions extends FormatWithCommasOptions {
  /** Prepend a `+` / `-` sign for non-zero values. Defaults to `false`. */
  withSign?: boolean;
}

/**
 * Format a value as a percentage string. The input is the percentage itself
 * (not a ratio): pass `54` for "54%", not `0.54`.
 *
 * @example
 * formatPercentage(54);                                       // "54%"
 * formatPercentage(54, { withSign: true });                   // "+54%"
 * formatPercentage(-54, { withSign: true });                  // "-54%"
 * formatPercentage(54.1, { fixedDecimals: 2 });               // "54.10%"
 * formatPercentage(12345.6, { fixedDecimals: 2 });            // "12,345.60%"
 * formatPercentage(0);                                        // "0%"
 */
export function formatPercentage(value?: Decimal.Value | null, options: FormatPercentageOptions = {}): string {
  const { withSign = false, ...formatWithCommasOptions } = options;

  const percentage = toDecimal(value);

  if (percentage.isZero()) return "0%";

  const sign = withSign ? (percentage.isPositive() ? "+" : "-") : "";

  return `${sign}${formatWithCommas(percentage.abs(), formatWithCommasOptions)}%`;
}
