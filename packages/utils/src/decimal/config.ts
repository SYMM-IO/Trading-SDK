import Decimal from "decimal.js";

/**
 * Decimal.js rounding modes, re-exported as a typed enum.
 *
 * @remarks
 * The integer values are identical to `Decimal.ROUND_*` constants, so this
 * enum is a drop-in replacement: passing `RoundingMode.ROUND_DOWN` to a
 * `decimal.toFixed(n, mode)` call works the same as passing `Decimal.ROUND_DOWN`.
 * Using the enum gives consumers typed names without depending directly on
 * Decimal.js's internal numeric constants.
 */
export enum RoundingMode {
  /** Round away from zero. */
  ROUND_UP = 0,
  /** Round toward zero (truncate). The SDK's default for token math. */
  ROUND_DOWN = 1,
  /** Round toward positive infinity. */
  ROUND_CEIL = 2,
  /** Round toward negative infinity. */
  ROUND_FLOOR = 3,
  /** Round to nearest; ties round away from zero. */
  ROUND_HALF_UP = 4,
  /** Round to nearest; ties round toward zero. */
  ROUND_HALF_DOWN = 5,
  /** Round to nearest; ties round to even (banker's rounding). */
  ROUND_HALF_EVEN = 6,
  /** Round to nearest; ties round toward positive infinity. */
  ROUND_HALF_CEIL = 7,
  /** Round to nearest; ties round toward negative infinity. */
  ROUND_HALF_FLOOR = 8,
}

/**
 * A `Decimal` instance representing zero. Cached so repeat calls don't
 * allocate; safe to compare with `.isZero()` or `.eq(ZERO_DECIMAL)`.
 */
export const ZERO_DECIMAL: Decimal = new Decimal(0);

/**
 * Options accepted by {@link configureSymmDecimal}.
 */
export interface ConfigureSymmDecimalOptions {
  /** Maximum significant digits for operations. Default `28` (enough for 18-decimal token math). */
  precision?: number;
  /** Default rounding mode applied by operations. Default `ROUND_DOWN`. */
  rounding?: RoundingMode;
  /** Negative-exponent threshold at which `.toString()` switches to scientific. Default `-20`. */
  toExpNeg?: number;
  /** Positive-exponent threshold at which `.toString()` switches to scientific. Default `20`. */
  toExpPos?: number;
}

/**
 * Apply SYMMIO SDK-recommended Decimal.js settings globally.
 *
 * **Side-effect warning**: this mutates the global `Decimal` config — every
 * Decimal instance in the host app (not just SDK uses) will see the new
 * settings. Call once at app startup if you want Explorer-style precision
 * (`28` significant digits, `ROUND_DOWN` default, no scientific notation up
 * to `1e±20`). Skip if your app already has its own Decimal config.
 *
 * The SDK's own formatters do **not** depend on this being called — they
 * pass explicit precision and rounding to every `.toFixed()` call.
 *
 * @example
 * import { configureSymmDecimal } from "@symm-frontier/utils/decimal";
 * configureSymmDecimal(); // at app entrypoint
 */
export function configureSymmDecimal(options: ConfigureSymmDecimalOptions = {}): void {
  Decimal.set({
    precision: options.precision ?? 28,
    rounding: options.rounding ?? RoundingMode.ROUND_DOWN,
    toExpNeg: options.toExpNeg ?? -20,
    toExpPos: options.toExpPos ?? 20,
  });
}
