import { QuoteLifecycle, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";

/** Human label for each write-progression stage. */
export const LIFECYCLE_LABEL: Record<QuoteLifecycle, string> = {
  [QuoteLifecycle.OPTIMISTIC]: "Optimistic",
  [QuoteLifecycle.PRICE_FILLED]: "Price filled",
  [QuoteLifecycle.WRITE_ONCHAIN]: "Writing on-chain",
  [QuoteLifecycle.ONCHAIN]: "On-chain",
  [QuoteLifecycle.OPTIMISTIC_CLOSE]: "Close requested",
  [QuoteLifecycle.CLOSE_PRICE_FILLED]: "Close accepted",
  [QuoteLifecycle.WRITE_ONCHAIN_CLOSE]: "Writing close on-chain",
  [QuoteLifecycle.CLOSED]: "Closed",
  [QuoteLifecycle.FAILED]: "Failed",
};

/** Human label for each on-chain status. */
const STATUS_LABEL: Record<QuoteStatus, string> = {
  [QuoteStatus.PENDING]: "Pending",
  [QuoteStatus.LOCKED]: "Locked",
  [QuoteStatus.CANCEL_PENDING]: "Cancelling",
  [QuoteStatus.CANCELED]: "Cancelled",
  [QuoteStatus.OPENED]: "Opened",
  [QuoteStatus.CLOSE_PENDING]: "Closing",
  [QuoteStatus.CANCEL_CLOSE_PENDING]: "Cancelling close",
  [QuoteStatus.CLOSED]: "Closed",
  [QuoteStatus.LIQUIDATED]: "Liquidated",
  [QuoteStatus.EXPIRED]: "Expired",
  [QuoteStatus.LIQUIDATED_PENDING]: "Liquidating",
};

/** Statuses that need the reader's attention rather than a quiet grey dot. */
const ALERT_STATUSES = new Set<QuoteStatus>([
  QuoteStatus.LIQUIDATED,
  QuoteStatus.LIQUIDATED_PENDING,
  QuoteStatus.EXPIRED,
]);

/** How a quote's current state should read on a card or a row. */
export interface QuoteStateDisplay {
  label: string;
  /**
   * `pending` — not settled on chain yet, drawn in coral.
   * `alert` — liquidated or expired, drawn in amber.
   * `muted` — settled and unremarkable, drawn grey.
   */
  tone: "muted" | "pending" | "alert";
}

/**
 * The state a quote should announce, and how loudly.
 *
 * An anchored row is named by its on-chain {@link QuoteStatus}, which is the more
 * specific fact; a row the chain has not confirmed falls back to its
 * {@link QuoteLifecycle}, which is all there is. Tone is spent only on rows that
 * have not settled or have gone wrong — everything ordinary stays grey, so a
 * quiet board looks quiet.
 *
 * @example
 * ```ts
 * quoteState(openPosition);   // { label: "Opened", tone: "muted" }
 * quoteState(optimisticOpen); // { label: "Price filled", tone: "pending" }
 * ```
 */
export function quoteState(quote: UnifiedQuote): QuoteStateDisplay {
  if (quote.raw.onchain === undefined) {
    return { label: LIFECYCLE_LABEL[quote.lifecycle] ?? String(quote.lifecycle), tone: "pending" };
  }
  if (quote.quoteStatus === undefined) {
    return { label: LIFECYCLE_LABEL[quote.lifecycle] ?? String(quote.lifecycle), tone: "muted" };
  }
  return {
    label: STATUS_LABEL[quote.quoteStatus] ?? String(quote.quoteStatus),
    tone: ALERT_STATUSES.has(quote.quoteStatus) ? "alert" : "muted",
  };
}

/** Tailwind background for a state dot of the given tone. */
export function stateDotClassName(tone: QuoteStateDisplay["tone"]): string {
  switch (tone) {
    case "pending":
      return "bg-primary";
    case "alert":
      return "bg-warning";
    default:
      return "bg-muted-foreground/60";
  }
}
