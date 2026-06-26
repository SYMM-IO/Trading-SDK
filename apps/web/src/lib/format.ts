import { WEI_DECIMALS, formatTokenAmount } from "@theoldvarorg/utils";

export { WEI_DECIMALS };

/** Max fractional digits shown for collateral / USD values across the app. */
export const USD_MAX_DECIMALS = 4;

/** Fallback decimals for a market price when the market's `price_precision` is not loaded yet. */
export const DEFAULT_PRICE_PRECISION = 6;

/** Fallback decimals for a market quantity when the market's `quantity_precision` is not loaded yet. */
export const DEFAULT_QUANTITY_PRECISION = 6;

/**
 * Format a raw collateral amount (token base units) for display, capped at
 * {@link USD_MAX_DECIMALS} fractional digits (truncated, trailing zeros stripped).
 * Use for every on-screen dollar / USDC figure.
 */
export function formatUsd(raw: bigint, decimals: number = WEI_DECIMALS): string {
  return formatTokenAmount(raw, decimals, { maxFractionDigits: USD_MAX_DECIMALS });
}
