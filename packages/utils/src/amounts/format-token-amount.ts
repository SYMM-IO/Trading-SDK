import Decimal from "decimal.js";
import { rawToDecimal } from "./decimal-bridge";

/**
 * Optional formatting controls for {@link formatTokenAmount}.
 */
export interface FormatTokenAmountOptions {
  /**
   * Maximum number of digits to keep after the decimal point. The result is
   * **truncated** (not rounded) to this many fractional digits, matching on-chain
   * integer math. Omit to return the full-precision value.
   */
  maxFractionDigits?: number;
  /**
   * Whether to strip trailing zeros from the fractional part. `true` (the
   * default) gives `"1.5"`; `false` gives `"1.500000"` for `maxFractionDigits: 6`.
   */
  trimTrailingZeros?: boolean;
}

/**
 * Format a raw on-chain `bigint` amount for human display.
 *
 * Internally uses `Decimal.js` for the divide-by-`10^decimals` step so the
 * output is precise at arbitrary decimal depth (no JS float drift at 18
 * decimals). When `maxFractionDigits` is given the value is truncated (not
 * rounded) to that many fractional digits.
 *
 * @example
 * formatTokenAmount(1_234_567_890n, 6);                       // "1234.56789"
 * formatTokenAmount(1_234_567_890n, 6, { maxFractionDigits: 2 }); // "1234.56"
 * formatTokenAmount(1_000_000n, 6, { maxFractionDigits: 4, trimTrailingZeros: false }); // "1.0000"
 *
 * @param raw - Raw amount in the smallest unit.
 * @param decimals - Token decimal precision.
 * @param opts - Optional formatting controls.
 */
export function formatTokenAmount(raw: bigint, decimals: number, opts?: FormatTokenAmountOptions): string {
  const value = rawToDecimal(raw, decimals);

  const truncated =
    opts?.maxFractionDigits === undefined
      ? value
      : new Decimal(value.toFixed(opts.maxFractionDigits, Decimal.ROUND_DOWN));

  const trim = opts?.trimTrailingZeros ?? true;

  if (trim) {
    return truncated.toFixed();
  }

  return opts?.maxFractionDigits === undefined ? truncated.toFixed() : truncated.toFixed(opts.maxFractionDigits);
}
