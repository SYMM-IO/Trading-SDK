import Decimal from "decimal.js";

/**
 * Convert a raw on-chain `bigint` amount to a `Decimal` representing the
 * human-readable token quantity.
 *
 * Uses `Decimal.js` so callers can chain UI math (multiplication, percentages,
 * comparisons) without ever losing precision to JS floats — the typical pitfall
 * when working with token amounts at 18 decimals.
 *
 * @example
 * const balance = rawToDecimal(1_500_000n, 6); // Decimal("1.5")
 * balance.times("0.997").toFixed(4);           // "1.4955"
 *
 * @param raw - The raw on-chain amount (in the smallest unit, e.g. wei).
 * @param decimals - The token's decimal precision.
 */
export function rawToDecimal(raw: bigint, decimals: number): Decimal {
  return new Decimal(raw.toString()).div(new Decimal(10).pow(decimals));
}

/**
 * Convert a `Decimal` human-readable amount to a raw on-chain `bigint`.
 *
 * Truncates anything below the token's smallest unit (no rounding up), matching
 * how on-chain integer math behaves. Pass a pre-rounded `Decimal` if you want a
 * different rounding policy.
 *
 * @example
 * decimalToRaw(new Decimal("1.5"), 6);    // 1_500_000n
 * decimalToRaw(new Decimal("1.234567891"), 6); // 1_234_567n (last digit truncated)
 *
 * @param value - Human-readable amount as a `Decimal`.
 * @param decimals - The token's decimal precision.
 */
export function decimalToRaw(value: Decimal, decimals: number): bigint {
  const scaled = value.times(new Decimal(10).pow(decimals)).toFixed(0, Decimal.ROUND_DOWN);
  return BigInt(scaled);
}
