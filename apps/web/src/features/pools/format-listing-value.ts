import { LISTING_VALUE_DECIMALS, ListingDepositChainId, ListingMarketStatus } from "@symmio/trading-core";
import { formatCompactCurrency, formatPercentage } from "@symmio/utils";
import { formatUnits } from "@symmio/utils/decimal";

/** Placeholder for a figure the listing service did not report. */
export const ABSENT = "—";

/**
 * Format an 18-decimal listing figure as a compact USD amount (`$1.2M`).
 *
 * Returns {@link ABSENT} for `null` so an unreported figure reads differently
 * from a real `$0` — the two mean different things on a young market.
 */
export function formatListingUsd(raw: bigint | null): string {
  if (raw === null) return ABSENT;
  return formatCompactCurrency(formatUnits(raw, LISTING_VALUE_DECIMALS), { maxDecimals: 2 });
}

/**
 * Format an 18-decimal listing rate as a percentage.
 *
 * The descaled value **is** the percentage (`1e18` = `1%`), so there is no
 * multiply by 100 here — that was the bug that rendered a `-0.76%` 24h APY as
 * `-75.78%`. Money fields on the same 18-decimal scale mean USD instead; see
 * {@link formatListingUsd}.
 */
export function formatListingRate(raw: bigint | null): string {
  if (raw === null) return ABSENT;
  return formatPercentage(formatUnits(raw, LISTING_VALUE_DECIMALS), {
    maxDecimals: 2,
    withSign: raw < 0n,
  });
}

/**
 * Format the user's pool-share percentage — a plain `number` that already **is**
 * the percentage (`12.5` → "12.5%"), not an 18-decimal figure and not a ratio.
 *
 * Returns {@link ABSENT} for `null` so an unreported share reads differently from
 * a real `0%`.
 */
export function formatSharePercentage(value: number | null): string {
  if (value === null) return ABSENT;
  return formatPercentage(value, { maxDecimals: 2 });
}

/** Format a Unix-seconds listing timestamp as a short absolute date. */
export function formatListingDate(seconds: number | null): string {
  if (seconds === null) return ABSENT;
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Sign of a rate, for tinting a cell. `null` and zero are both neutral. */
export function rateTone(raw: bigint | null): "positive" | "negative" | "neutral" {
  if (raw === null || raw === 0n) return "neutral";
  return raw > 0n ? "positive" : "negative";
}

/**
 * Format a rolling-limit reset timestamp as a readable UTC date-time. The
 * service returns a Unix timestamp; a value below `1e12` is seconds, so scale it
 * to milliseconds before constructing the `Date`.
 */
export function formatResetAt(resetAt: number): string {
  const ms = resetAt < 1e12 ? resetAt * 1000 : resetAt;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(ms));
}

/** Display names for the chains the listing service accepts deposits on. */
export const DEPOSIT_CHAIN_LABELS: Record<ListingDepositChainId, string> = {
  [ListingDepositChainId.SOLANA]: "Solana",
  [ListingDepositChainId.BSC]: "BSC",
  [ListingDepositChainId.BASE]: "Base",
  [ListingDepositChainId.SONIC]: "Sonic",
  [ListingDepositChainId.ARBITRUM_ONE]: "Arbitrum",
  [ListingDepositChainId.HYPER_EVM]: "HyperEVM",
};

/** Label for a deposit chain, falling back to the raw id for one we do not know. */
export function depositChainLabel(chainId: ListingDepositChainId): string {
  return DEPOSIT_CHAIN_LABELS[chainId] ?? `Chain ${chainId}`;
}

/** Human label and badge tone for each point in the listing lifecycle. */
export const LISTING_STATUS_DISPLAY: Record<
  ListingMarketStatus,
  { label: string; variant: "positive" | "warning" | "secondary" | "destructive" | "outline" }
> = {
  [ListingMarketStatus.LISTED]: { label: "Live", variant: "positive" },
  [ListingMarketStatus.WAITING_FOR_DEPOSIT]: { label: "Awaiting deposit", variant: "warning" },
  [ListingMarketStatus.UNDER_REVIEW]: { label: "Under review", variant: "secondary" },
  [ListingMarketStatus.REJECTED]: { label: "Rejected", variant: "destructive" },
  [ListingMarketStatus.DELISTED]: { label: "Delisted", variant: "outline" },
};

/**
 * Shorten a contract address for display. Handles both 0x EVM addresses and the
 * longer base58 Solana ones the catalog also carries.
 */
export function truncateContractAddress(address: string): string {
  return address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
