import { LISTING_VALUE_DECIMALS } from "@symmio/trading-core";
import { formatCompactCurrency, formatWithCommas } from "@symmio/utils";
import { formatUnits } from "@symmio/utils/decimal";

/** Placeholder for a figure the source did not report. */
export const ABSENT = "—";

/** Protocol values from the subgraph are 18-decimal, like the listing backend's. */
export const PROTOCOL_DECIMALS = LISTING_VALUE_DECIMALS;

/** Format an 18-decimal figure as compact USD. */
export function usd(raw: bigint | null | undefined): string {
  if (raw === null || raw === undefined) return ABSENT;
  return formatCompactCurrency(formatUnits(raw, PROTOCOL_DECIMALS), { maxDecimals: 2 });
}

/** Format an 18-decimal figure as a bare quantity, no currency symbol. */
export function quantity(raw: bigint | null | undefined): string {
  if (raw === null || raw === undefined) return ABSENT;
  return formatWithCommas(formatUnits(raw, PROTOCOL_DECIMALS), { maxDecimals: 4 });
}

/**
 * Format an 18-decimal price.
 *
 * Lowcap prices run small — a token can trade at `0.000130` — so a fixed two
 * decimals would render most of this catalog as `0.00`. `dynamicDecimals` keeps
 * significant digits after the leading zeros instead.
 */
export function price(raw: bigint | null | undefined): string {
  if (raw === null || raw === undefined) return ABSENT;
  return formatWithCommas(formatUnits(raw, PROTOCOL_DECIMALS), { dynamicDecimals: 4 });
}

/** Format a Unix-seconds timestamp as a short local date and time. */
export function timestamp(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds === 0) return ABSENT;
  return new Date(seconds * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Sign of a signed figure, for tinting a cell. */
export function signTone(raw: bigint | null | undefined): "positive" | "negative" | "neutral" {
  if (raw === null || raw === undefined || raw === 0n) return "neutral";
  return raw > 0n ? "positive" : "negative";
}

/** Cell tint per sign. */
export const SIGN_TONE_CLASS = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-muted-foreground",
} as const;

/** Shorten an address for display; handles both 0x and base58 forms. */
export function shortAddress(address: string): string {
  return address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * The subgraph's raw `PositionType` ordinal: `0` long, `1` short.
 *
 * Kept as a local map rather than an SDK enum because the pool reads surface the
 * ordinal exactly as the subgraph stores it.
 */
export function positionSideLabel(positionType: number | null): string {
  if (positionType === null) return ABSENT;
  return positionType === 0 ? "Long" : "Short";
}
