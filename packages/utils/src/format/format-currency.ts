import Decimal from "decimal.js";
import { formatWithCommas, type FormatWithCommasOptions } from "./format-with-commas";

/**
 * Currency display modes:
 * - `symbol` (default): `$1,234.50`
 * - `code`: `1,234.50 USD`
 * - `symbol-code`: `$1,234.50 USD`
 * - `none`: just the number
 */
export type CurrencyDisplay = "symbol" | "code" | "symbol-code" | "none";

/**
 * Options for {@link formatCurrency}.
 */
export interface FormatCurrencyOptions extends FormatWithCommasOptions {
  /** Display mode. Defaults to `symbol`. */
  display?: CurrencyDisplay;
}

/**
 * Format a value as USD currency. Thin wrapper over {@link formatWithCommas}
 * that adds the `$` or `USD` decoration.
 *
 * @example
 * formatCurrency(1234.567);                              // "$1,234.56"
 * formatCurrency(1234.5, { display: "code" });           // "1,234.50 USD"
 * formatCurrency(1234.5, { display: "symbol-code" });    // "$1,234.50 USD"
 * formatCurrency(0.000123, { dynamicDecimals: 2 });      // "$0.00012"
 * formatCurrency(undefined);                             // "$0"
 */
export function formatCurrency(value?: Decimal.Value | null, options: FormatCurrencyOptions = {}): string {
  const { display = "symbol", ...formatWithCommasOptions } = options;
  const amount = formatWithCommas(value, formatWithCommasOptions);
  return decorate(amount, display);
}

/**
 * Attach the currency decoration. Pulled out so {@link formatCurrency} and
 * `formatCompactCurrency` share one source of truth.
 *
 * @internal
 */
export function decorateCurrency(amount: string, display: CurrencyDisplay): string {
  return decorate(amount, display);
}

function decorate(amount: string, display: CurrencyDisplay): string {
  const isNegative = amount.startsWith("-");
  const absoluteAmount = isNegative ? amount.slice(1) : amount;
  const negativeSign = isNegative ? "-" : "";

  switch (display) {
    case "symbol":
      return `${negativeSign}$${absoluteAmount}`;
    case "code":
      return `${negativeSign}${absoluteAmount} USD`;
    case "symbol-code":
      return `${negativeSign}$${absoluteAmount} USD`;
    case "none":
      return amount;
  }
}
