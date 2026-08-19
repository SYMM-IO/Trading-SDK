/**
 * Scaling factor of an 18-decimal-wei fixed-point value (`10n ** 18n`).
 *
 * Every amount and price the SDK exposes is 18-decimal-wei `bigint`, so this is
 * the multiplier/divisor used whenever bigint math has to scale into or out of
 * that fixed-point representation.
 */
export const WEI = 10n ** 18n;

/**
 * Multiply two 18-decimal-wei fixed-point values, rescaling the `WEI²`-scaled
 * product back to wei.
 *
 * This is the SDK's single definition of the `quantity × price` convention. The
 * product is **truncated toward zero** (bigint division semantics — a negative
 * result truncates up, not down), so a fold that calls this per item carries at
 * most 1 wei of error per item instead of rounding once at the end. Sums built
 * this way stay exact and order-independent.
 *
 * Use it wherever a wei quantity meets a wei price: notional, PnL, fees. Do
 * **not** use it to build a numerator that will later be divided by another
 * wei-scaled value — truncating here collapses the extra `WEI` factor that
 * divide depends on. `aggregateGroupMetrics`'s `weightedOpenPrice` is the one
 * such case in the SDK, and it deliberately keeps its numerator at `WEI²`.
 *
 * @param a - An 18-decimal-wei value, typically a quantity.
 * @param b - An 18-decimal-wei value, typically a price. May be signed.
 * @returns The product, rescaled to 18-decimal wei.
 *
 * @example
 * ```ts
 * mulWei(2_000000000000000000n, 150_000000000000000000n); // 300_000000000000000000n
 * ```
 */
export function mulWei(a: bigint, b: bigint): bigint {
  return (a * b) / WEI;
}
