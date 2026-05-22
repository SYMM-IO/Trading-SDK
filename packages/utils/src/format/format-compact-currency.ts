import Decimal from "decimal.js";
import { formatCompact, type FormatCompactOptions } from "./format-compact";
import { decorateCurrency, type CurrencyDisplay } from "./format-currency";

/**
 * Options for {@link formatCompactCurrency}.
 */
export interface FormatCompactCurrencyOptions extends FormatCompactOptions {
  /** Display mode. See {@link CurrencyDisplay}. Defaults to `symbol`. */
  display?: CurrencyDisplay;
}

/**
 * Compact-notation currency formatter. Combines {@link formatCompact} with
 * the `$` / `USD` decoration of {@link formatCurrency}.
 *
 * @example
 * formatCompactCurrency(1500);                    // "$1.5K"
 * formatCompactCurrency(1_500_000);               // "$1.5M"
 * formatCompactCurrency(1_500_000, { display: "code" });        // "1.5M USD"
 * formatCompactCurrency(1_500_000, { display: "symbol-code" }); // "$1.5M USD"
 * formatCompactCurrency(12_345_678, { maxDecimals: 1 });        // "$12.3M"
 */
export function formatCompactCurrency(
  value?: Decimal.Value | null,
  options: FormatCompactCurrencyOptions = {},
): string {
  const { display = "symbol", ...formatCompactOptions } = options;
  const compactValue = formatCompact(value, formatCompactOptions);
  return decorateCurrency(compactValue, display);
}
