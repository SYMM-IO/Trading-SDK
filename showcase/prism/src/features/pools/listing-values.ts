import { formatCompact, formatDate, formatPercent, formatUsd } from "@/lib/format";
import { LISTING_VALUE_DECIMALS, ListingDepositChainId, ListingMarketStatus } from "@symmio/trading-core";

/** What a figure the service did not report renders as. Never `0`. */
export const ABSENT = "—";

/**
 * Descale one 18-decimal listing figure, preserving "not reported".
 *
 * `null` and `0` are different answers from this backend — a pool with no TVL
 * snapshot has not reported `$0` — so this returns `undefined` rather than
 * collapsing to a number the way `fromWei` does.
 */
export function listingNumber(value: bigint | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  return Number(value) / 10 ** LISTING_VALUE_DECIMALS;
}

/**
 * A listing **money** figure: descaled 18-decimal USD (`1e18` = `$1`).
 *
 * Money and rates share the 18-decimal scale on this backend and mean entirely
 * different things once descaled, which is why they never share a formatter.
 */
export function listingUsd(value: bigint | null | undefined, options: { exact?: boolean } = {}): string {
  return formatUsd(listingNumber(value), options);
}

/**
 * A listing **reward** figure as USD, at four decimals.
 *
 * Rewards are the one money field on this backend that is routinely sub-cent: a
 * few days of LP yield on a small deposit is fractions of a dollar, and
 * `listingUsd`'s two-decimal floor collapses every one of them to `$0.00` —
 * which reads as "nothing to claim" next to a Claim button whose mutation then
 * sends the full 18-decimal amount. Four decimals is what makes the figure and
 * the button agree.
 *
 * `exact` on purpose: a claim total is a receipt, and `$12K` is not a receipt.
 */
export function listingReward(value: bigint | null | undefined): string {
  return formatUsd(listingNumber(value), { exact: true, maxDecimals: 4 });
}

/**
 * The same four-decimal reward figure without the currency symbol, for a row
 * that writes its unit out — `0.4213 USDC`.
 *
 * Not `listingAmount`: that compacts and trims to two decimals, which is right
 * for LP shares and wrong for the same reason `listingUsd` is wrong here.
 */
export function listingRewardAmount(value: bigint | null | undefined, symbol?: string): string {
  const numeric = listingNumber(value);
  if (numeric === undefined) return ABSENT;
  /* Sign is split off the magnitude so a negative renders with a true minus
     (U+2212). `toLocaleString` emits an ASCII hyphen, which the design system
     forbids on a number. */
  const body = Math.abs(numeric).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const signed = numeric < 0 ? `−${body}` : body;
  return symbol ? `${signed} ${symbol}` : signed;
}

/** A listing **count** — LP shares, token balances. Same descale, no currency. */
export function listingAmount(value: bigint | null | undefined): string {
  const numeric = listingNumber(value);
  if (numeric === undefined) return ABSENT;
  return formatCompact(numeric);
}

/**
 * A listing **rate**: the descaled value already **is** the percentage.
 *
 * `1e18` is `1%`, not `100%`. Multiplying by 100 here is the bug that renders a
 * −0.76% APY as −75.78%, and it is easy to reach for because the money fields
 * on the same scale need no such thought.
 */
export function listingRate(value: bigint | null | undefined): string {
  const numeric = listingNumber(value);
  if (numeric === undefined) return ABSENT;
  /* No `signed` flag: `formatPercent` already prints a true minus for anything
     negative, and the flag only adds a leading `+` — which on a yield column
     would decorate every healthy pool. A rate's sign is carried by its tone
     (see `rateTone`) and by the minus itself. */
  return formatPercent(numeric);
}

/** A share the service reports as a plain number that already is a percentage. */
export function sharePercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ABSENT;
  return formatPercent(value);
}

/** Tone for a rate cell. `null` and `0` are both neutral — neither is a gain. */
export function rateTone(value: bigint | null | undefined): "long" | "short" | "muted" {
  if (value === null || value === undefined || value === 0n) return "muted";
  return value > 0n ? "long" : "short";
}

/** A listing timestamp — Unix **seconds**, `null` before the event happened. */
export function listingDate(seconds: number | null | undefined): string {
  if (!seconds) return ABSENT;
  return formatDate(seconds);
}

/** A listing timestamp with the clock, for transaction and quote rows. */
export function listingDateTime(seconds: number | null | undefined): string {
  if (!seconds) return ABSENT;
  return new Date(seconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format the weekly cap's reset stamp.
 *
 * The service's `reset_at` unit is not pinned by the schema, so this reads the
 * magnitude rather than trusting one: anything below `1e12` is seconds.
 */
export function formatResetAt(value: number | null | undefined): string {
  if (!value) return ABSENT;
  const millis = value < 1e12 ? value * 1000 : value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(millis));
}

/**
 * The chains a pool's collateral can arrive from.
 *
 * A pool's `chainId` is the chain its **token** and deposits live on — Solana,
 * BSC, Base — and is unrelated to HyperEVM, where the perp settles. `SOLANA` is
 * a `0` sentinel rather than an EVM chain id, and its addresses are base58.
 */
export const DEPOSIT_CHAIN_LABELS: Record<ListingDepositChainId, string> = {
  [ListingDepositChainId.SOLANA]: "Solana",
  [ListingDepositChainId.BSC]: "BSC",
  [ListingDepositChainId.SONIC]: "Sonic",
  [ListingDepositChainId.BASE]: "Base",
  [ListingDepositChainId.ARBITRUM_ONE]: "Arbitrum",
  [ListingDepositChainId.HYPER_EVM]: "HyperEVM",
};

/** Human name for a deposit chain, falling back to its id. */
export function depositChainLabel(chainId: ListingDepositChainId | number): string {
  return DEPOSIT_CHAIN_LABELS[chainId as ListingDepositChainId] ?? `Chain ${chainId}`;
}

/** The chain's own brand color, as a CSS variable reference. */
export function depositChainColor(chainId: ListingDepositChainId | number): string {
  switch (chainId) {
    case ListingDepositChainId.SOLANA:
      return "var(--chain-solana)";
    case ListingDepositChainId.BSC:
      return "var(--chain-bsc)";
    case ListingDepositChainId.BASE:
      return "var(--chain-base)";
    case ListingDepositChainId.ARBITRUM_ONE:
      return "var(--chain-arbitrum)";
    case ListingDepositChainId.HYPER_EVM:
      return "var(--chain-hyperevm)";
    case ListingDepositChainId.SONIC:
      return "var(--chain-sonic)";
    default:
      /* Only a chain the enum does not name reaches here. Every chain the
         listing service actually offers has its own hue above, so a grey dot
         means "unrecognised", not "Sonic". */
      return "var(--fg-3)";
  }
}

/** How one listing status renders: its human label and its lifecycle hue. */
export interface ListingStatusStyle {
  /** Human label. Never the wire string, except as a fallback for an unknown status. */
  label: string;
  /** A lifecycle color token, immune to the palette mode. */
  color: string;
}

/**
 * How a listing's pipeline state reads.
 *
 * These are lifecycle colors, not market colors: like a quote's state pill they
 * stay put through a palette switch, because "this pool is live" must not
 * change hue with the mode.
 */
export const LISTING_STATUS_DISPLAY: Record<ListingMarketStatus, ListingStatusStyle> = {
  [ListingMarketStatus.LISTED]: { label: "Live", color: "var(--state-opened)" },
  [ListingMarketStatus.WAITING_FOR_DEPOSIT]: { label: "Awaiting deposit", color: "var(--state-pending)" },
  [ListingMarketStatus.UNDER_REVIEW]: { label: "Under review", color: "var(--state-locked)" },
  [ListingMarketStatus.REJECTED]: { label: "Rejected", color: "var(--state-liquidated)" },
  [ListingMarketStatus.DELISTED]: { label: "Delisted", color: "var(--state-closed)" },
};

/** Display for a market status, tolerating a value the backend added later. */
export function listingStatusStyle(status: ListingMarketStatus | string): ListingStatusStyle {
  return LISTING_STATUS_DISPLAY[status as ListingMarketStatus] ?? { label: String(status), color: "var(--fg-3)" };
}

/** A pool's stable row key. Two deposit chains can hold the same address. */
export function poolKey(chainId: ListingDepositChainId | number, contractAddress: string): string {
  return `${chainId}:${contractAddress}`;
}
