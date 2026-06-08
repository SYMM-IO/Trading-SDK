/**
 * `@symm-frontier/utils` — framework-agnostic helpers for SYMMIO SDK consumers.
 *
 * Sub-entries are available for deep imports:
 *
 * - `@symm-frontier/utils/amounts` — `bigint` ↔ string helpers (viem-backed).
 * - `@symm-frontier/utils/decimal` — Decimal-based math (Decimal.js).
 * - `@symm-frontier/utils/format`  — display formatters (commas, compact, currency, %, dynamic).
 * - `@symm-frontier/utils/address` — checksummed and generic hex shorteners.
 */

/**
 * Amount helpers — `bigint` focused
 * ---------------------------------
 * Format and parse on-chain token amounts via viem. Use these when you have a
 * raw `bigint` or are writing values directly to a contract call.
 */
export {
  WEI_DECIMALS,
  decimalToRaw,
  formatTokenAmount,
  parseTokenAmount,
  rawToDecimal,
  type FormatTokenAmountOptions,
} from "./amounts";

/**
 * Decimal helpers
 * ---------------
 * Helpers built on Decimal.js for chainable UI math. `formatUnits` /
 * `parseUnits` here return `Decimal`, in contrast to viem's same-named
 * functions which return / take strings. Available via the deep import
 * `@symm-frontier/utils/decimal` to avoid name collisions with viem at the
 * root barrel.
 */
export {
  RoundingMode,
  ZERO_DECIMAL,
  configureSymmDecimal,
  safeDivide,
  toDecimal,
  type ConfigureSymmDecimalOptions,
} from "./decimal";

/**
 * Display formatters
 * ------------------
 * Decimal-backed string formatters for UI output: thousand separators,
 * compact (K/M/B/T/Q), currency, percentage, adaptive precision, and relative
 * timestamp labels.
 */
export {
  formatCompact,
  formatCompactCurrency,
  formatCurrency,
  formatDynamicDecimals,
  formatPercentage,
  formatRelativeTimestamp,
  formatWithCommas,
  type CompactUnit,
  type CurrencyDisplay,
  type FormatCompactCurrencyOptions,
  type FormatCompactOptions,
  type FormatCurrencyOptions,
  type FormatDynamicDecimalsOptions,
  type FormatPercentageOptions,
  type FormatRelativeTimestampOptions,
  type FormatWithCommasOptions,
} from "./format";

/**
 * Address & hash helpers
 * ----------------------
 * `shortenAddress` checksums + slices an EVM address; `minifyHash` works on
 * any hex-ish string (tx hashes, selectors).
 */
export { minifyHash, shortenAddress, type MinifyHashOptions, type ShortenAddressOptions } from "./address";
