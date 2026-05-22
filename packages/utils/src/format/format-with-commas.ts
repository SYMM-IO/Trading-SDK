import Decimal from "decimal.js";
import { isNotNil } from "ramda";
import { RoundingMode } from "../decimal/config";
import { toDecimal } from "../decimal/to-decimal";
import { formatDynamicDecimals } from "./format-dynamic-decimals";

/**
 * Options for {@link formatWithCommas}.
 */
export interface FormatWithCommasOptions {
  /** Cap on decimal places; trailing zeros are stripped. */
  maxDecimals?: number;
  /** Exact number of decimal places, padded with zeros. Takes precedence over `maxDecimals`. */
  fixedDecimals?: number;
  /** Rounding mode. Defaults to `ROUND_DOWN`. */
  rounding?: RoundingMode;
  /**
   * Dynamic-decimal mode: show this many significant digits after the first
   * non-zero. See {@link formatDynamicDecimals} for behavior. Ignored when
   * `fixedDecimals` is set.
   */
  dynamicDecimals?: number;
}

/**
 * Format a number with thousands separators and configurable decimal handling.
 *
 * @example
 * formatWithCommas(1234.4, { fixedDecimals: 4 });        // "1,234.4000"
 * formatWithCommas(1234.123456, { maxDecimals: 5 });     // "1,234.12345"
 * formatWithCommas(0.000123, { dynamicDecimals: 2 });    // "0.00012"
 * formatWithCommas(undefined);                            // "0"
 * formatWithCommas(-123.12);                              // "-123.12"
 */
export function formatWithCommas(value?: Decimal.Value | null, options: FormatWithCommasOptions = {}): string {
  const { fixedDecimals, maxDecimals, dynamicDecimals, rounding = RoundingMode.ROUND_DOWN } = options;

  const decimal = toDecimal(value);

  /**
   * Dynamic-decimal mode produces its own fully-formatted string; we just add
   * the thousand separators on top.
   */
  if (isNotNil(dynamicDecimals) && !isNotNil(fixedDecimals)) {
    const formatted = formatDynamicDecimals(decimal, dynamicDecimals, { maxDecimals, rounding });
    return insertThousandSeparators(formatted);
  }

  let decimalPlaces = decimal.decimalPlaces();

  if (isNotNil(maxDecimals)) {
    decimalPlaces = Math.min(decimal.decimalPlaces(), maxDecimals);
  }
  if (isNotNil(fixedDecimals)) {
    decimalPlaces = fixedDecimals;
  }

  const formatted = decimal.toFixed(decimalPlaces, rounding);
  return insertThousandSeparators(formatted);
}

/**
 * Inject `,` between every group of 3 digits in the integer part of a
 * fixed-point string. Works for negative numbers (matches `-?\d+`) and leaves
 * the fractional part untouched.
 *
 * @internal
 */
function insertThousandSeparators(formatted: string): string {
  return formatted.replace(/^(-?\d+)(?=(?:\.\d+)?$)/, (integerPart) =>
    integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  );
}
