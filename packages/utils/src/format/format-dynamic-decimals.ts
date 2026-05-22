import Decimal from "decimal.js";
import { isNotNil } from "ramda";
import { RoundingMode } from "../decimal/config";
import { toDecimal } from "../decimal/to-decimal";

/**
 * Options for {@link formatDynamicDecimals}.
 */
export interface FormatDynamicDecimalsOptions {
  /** Hard cap on total decimal places, regardless of significance. */
  maxDecimals?: number;
  /** Rounding mode. Defaults to `ROUND_DOWN` (truncate). */
  rounding?: RoundingMode;
}

/**
 * Format a value with **dynamic** decimal precision based on its first
 * significant digit. Find the first non-zero digit after the decimal point
 * and show `significantDecimals` digits from there — keeps tiny prices
 * readable without trailing zeros on whole numbers.
 *
 * @example
 * formatDynamicDecimals(0.000123, 2);    // "0.00012"
 * formatDynamicDecimals(0.000001223, 2); // "0.0000012"
 * formatDynamicDecimals(1223.12321, 2);  // "1223.12"
 * formatDynamicDecimals(0.1, 2);         // "0.1" — no trailing zeros
 * formatDynamicDecimals(0, 2);           // "0"
 *
 * // With maxDecimals cap:
 * formatDynamicDecimals(0.0000123456, 3, { maxDecimals: 6 });  // "0.000012"
 * formatDynamicDecimals(0.0000123456, 3, { maxDecimals: 10 }); // "0.0000123"
 *
 * @param value - The value to format.
 * @param significantDecimals - Significant digits to show after the first non-zero.
 * @param options - Optional cap and rounding.
 */
export function formatDynamicDecimals(
  value: Decimal.Value | null | undefined,
  significantDecimals: number,
  options?: FormatDynamicDecimalsOptions,
): string {
  const { maxDecimals, rounding = RoundingMode.ROUND_DOWN } = options ?? {};

  const decimal = toDecimal(value);
  const absValue = decimal.abs();

  let decimalPlaces = 0;

  if (absValue.gt(0)) {
    /**
     * `toFixed(100)` is enough precision to find the first non-zero digit even
     * for very small numbers. The regex extracts the run of zeros + the first
     * non-zero digit; `leadingZeros` is the count of zeros between `.` and
     * that digit.
     */
    const str = absValue.toFixed(100);
    const match = str.match(/\.0*[1-9]/);

    if (match) {
      const leadingZeros = match[0].length - 2;
      const calculatedDecimals = leadingZeros + significantDecimals;
      decimalPlaces = Math.min(decimal.decimalPlaces(), calculatedDecimals);
    } else {
      decimalPlaces = 0;
    }
  }

  if (isNotNil(maxDecimals)) {
    decimalPlaces = Math.min(decimalPlaces, maxDecimals);
  }

  return decimal
    .toFixed(decimalPlaces, rounding)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}
