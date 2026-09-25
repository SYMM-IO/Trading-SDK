import { parseUnits } from "viem";

/**
 * Parse a user-typed amount string into a raw on-chain `bigint`, or `undefined`
 * when the input is empty, malformed, over-precise, or non-positive. `decimals`
 * differs by flow: 18 for allocate/margin/quote values, the collateral token's
 * decimals for deposit/withdraw. The explicit arg keeps callers honest.
 */
export function parseAmount(value: string, decimals: number): bigint | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d*\.?\d*$/.test(trimmed)) return undefined;
  const [, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return undefined;
  try {
    const raw = parseUnits(trimmed, decimals);
    return raw > 0n ? raw : undefined;
  } catch {
    return undefined;
  }
}

/** Parse a positive number (leverage, slippage, quantity), else `undefined`. */
export function parsePositiveNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

/** Parse a non-negative integer (e.g. leverage steps), else `undefined`. */
export function parseInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}
