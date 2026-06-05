import { parseUnits } from "viem";

/**
 * Parse a user-entered decimal string into collateral base units, or `undefined`
 * when the input is empty, malformed, has too many decimals, or is not positive.
 */
export function parseAmount(value: string, decimals: number): bigint | undefined {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "." || !/^\d*\.?\d*$/.test(trimmed)) return undefined;
  try {
    const parsed = parseUnits(trimmed, decimals);
    return parsed > 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
}
