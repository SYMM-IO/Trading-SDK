import { WEI } from "./wei";

/**
 * `part / total × 100` as an 18-decimal fixed-point percent
 * (`50% → 50_000000000000000000n`). Handles a signed `part` (a negative share
 * yields a negative percent).
 *
 * @param part - The covered amount, wei.
 * @param total - The denominator, wei.
 * @returns The percent, or `undefined` when `total` is not positive.
 *
 * @example
 * ```ts
 * sharePercent(25_000000000000000000n, 100_000000000000000000n); // 25_000000000000000000n
 * sharePercent(1n, 0n); // undefined
 * ```
 */
export function sharePercent(part: bigint, total: bigint): bigint | undefined {
  if (total <= 0n) return undefined;
  return (part * 100n * WEI) / total;
}
