import { parseUnits, toDecimal } from "@symmio/utils/decimal";

/** Decimal places of an 18-decimal-wei fixed-point value. */
const WEI_DECIMALS = 18;

/**
 * Convert a decimal price string — what every price feed in the SDK emits — to
 * 18-decimal wei.
 *
 * Tolerates more than 18 decimals by rounding, where viem's `parseUnits` throws.
 * Returns `undefined` — **never `0n`** — for an empty, malformed, or non-finite
 * input, so a caller can tell "no price yet" apart from "the price is zero".
 * That distinction is load-bearing: a fabricated `0n` mark price makes an
 * unrealized-PnL fold report a −100% loss instead of "unknown".
 *
 * @param value - Decimal price string, e.g. `"0.0085"`.
 * @returns The price in 18-decimal wei, or `undefined` when it cannot be parsed.
 *
 * @example
 * ```ts
 * decimalPriceToWei("150.5"); // 150_500000000000000000n
 * decimalPriceToWei("0");     // 0n        — a real zero price
 * decimalPriceToWei("");      // undefined — no price yet
 * ```
 */
export function decimalPriceToWei(value: string): bigint | undefined {
  if (!value) return undefined;
  try {
    const decimal = toDecimal(value);
    if (!decimal.isFinite()) return undefined;
    return BigInt(parseUnits(decimal, WEI_DECIMALS).toFixed(0));
  } catch {
    /** `toDecimal` throws on a malformed string; a half-typed price must never crash a caller. */
    return undefined;
  }
}
