import { parseUnits } from "viem";

/**
 * Parse a user-typed decimal string into a raw on-chain `bigint` amount.
 *
 * Thin wrapper around viem's `parseUnits` that normalizes input — accepts both
 * dot and comma decimal separators, strips surrounding whitespace, and treats
 * the empty string as `0n`.
 *
 * @example
 * parseTokenAmount("1234.5", 6); // 1_234_500_000n
 * parseTokenAmount("1,5", 6);    // 1_500_000n  (comma accepted)
 * parseTokenAmount("", 18);      // 0n
 *
 * @throws Viem's `InvalidDecimalNumberError` when the input is not a valid number.
 *
 * @param value - User-typed decimal string.
 * @param decimals - Token decimal precision.
 */
export function parseTokenAmount(value: string, decimals: number): bigint {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return 0n;
  return parseUnits(normalized, decimals);
}
