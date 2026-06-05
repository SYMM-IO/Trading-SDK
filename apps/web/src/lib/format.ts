import { formatTokenAmount } from "@symm-frontier/utils";

/** Max fractional digits shown for collateral / USD values across the app. */
export const USD_MAX_DECIMALS = 4;

/**
 * Format a raw collateral amount (token base units) for display, capped at
 * {@link USD_MAX_DECIMALS} fractional digits (truncated, trailing zeros stripped).
 * Use for every on-screen dollar / USDC figure.
 */
export function formatUsd(raw: bigint, decimals: number): string {
  return formatTokenAmount(raw, decimals, { maxFractionDigits: USD_MAX_DECIMALS });
}
