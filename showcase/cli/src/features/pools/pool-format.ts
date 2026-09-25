import { ListingDepositChainId, ListingMarketStatus } from "@symmio/trading-core";
import { formatUnits } from "viem";
import { theme } from "../../config/theme.js";
import { formatCompactUsd, formatToken } from "../../lib/format.js";

/** Human labels for the deposit chain a listed token lives on. */
export function poolChainLabel(chainId: ListingDepositChainId): string {
  switch (chainId) {
    case ListingDepositChainId.SOLANA:
      return "Solana";
    case ListingDepositChainId.BSC:
      return "BSC";
    case ListingDepositChainId.BASE:
      return "Base";
    case ListingDepositChainId.SONIC:
      return "Sonic";
    case ListingDepositChainId.ARBITRUM_ONE:
      return "Arbitrum";
    case ListingDepositChainId.HYPER_EVM:
      return "HyperEVM";
    default:
      return String(chainId);
  }
}

/** A concise label and terminal color for a listing lifecycle state. */
export function poolStatusMeta(status: ListingMarketStatus): { label: string; color: string } {
  switch (status) {
    case ListingMarketStatus.LISTED:
      return { label: "Listed", color: theme.positive };
    case ListingMarketStatus.WAITING_FOR_DEPOSIT:
      return { label: "Await deposit", color: theme.warning };
    case ListingMarketStatus.UNDER_REVIEW:
      return { label: "Under review", color: theme.info };
    case ListingMarketStatus.REJECTED:
      return { label: "Rejected", color: theme.negative };
    case ListingMarketStatus.DELISTED:
      return { label: "Delisted", color: theme.muted };
  }
}

/** Compact USD for the listing backend's 18-decimal money values. */
export function formatPoolUsd(value: bigint | null | undefined): string {
  if (value == null) return "—";
  return formatCompactUsd(formatUnits(value, 18));
}

/** Exact-enough USD for small user balances and rewards. */
export function formatPoolUsdFine(value: bigint | null | undefined): string {
  if (value == null) return "—";
  return `$${formatToken(value, 18, 4)}`;
}

/** Listing rates descale directly to percentages; they are not fractions. */
export function formatPoolRate(value: bigint | null | undefined): string {
  if (value == null) return "—";
  return `${formatToken(value, 18, 2)}%`;
}

/** Seconds of age as a compact human duration. */
export function formatPoolAge(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "—";
  const days = Math.floor(seconds / 86_400);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(seconds / 3_600);
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
}

/** Stable user-facing error text without assuming an SDK error subtype. */
export function poolErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The Pools service request failed.";
}

/** Convert an 18-decimal chart value to a display-only number. */
export function poolChartNumber(value: bigint): number {
  return Number(formatUnits(value, 18));
}
