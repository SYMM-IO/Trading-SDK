import { WEI_DECIMALS, formatTokenAmount } from "@symm-frontier/utils";
import { maxUint256 } from "viem";

export { WEI_DECIMALS };

/** Max fractional digits shown for collateral / USD values across the app. */
export const USD_MAX_DECIMALS = 4;

/**
 * An "approve once" ERC-20 grant sets the allowance to `maxUint256`. Anything at
 * or above half of that is, against any real balance, indistinguishable from
 * infinite, so we treat it as unlimited rather than print a ~78-digit number
 * that tells the reader nothing.
 */
export const UNLIMITED_ALLOWANCE_THRESHOLD = maxUint256 / 2n;

/** Whether a raw allowance is an effectively-unlimited (max) approval. */
export function isUnlimitedAllowance(raw: bigint): boolean {
  return raw >= UNLIMITED_ALLOWANCE_THRESHOLD;
}

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
