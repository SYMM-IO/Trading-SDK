import { QuoteLifecycle, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import { theme } from "../../config/theme.js";

/** A short label + accent color for a quote's lifecycle stage. */
export function lifecycleMeta(lifecycle: QuoteLifecycle): { label: string; color: string } {
  switch (lifecycle) {
    case QuoteLifecycle.OPTIMISTIC:
      return { label: "Opening", color: theme.warning };
    case QuoteLifecycle.PRICE_FILLED:
      return { label: "Filling", color: theme.warning };
    case QuoteLifecycle.WRITE_ONCHAIN:
      return { label: "Confirming", color: theme.warning };
    case QuoteLifecycle.ONCHAIN:
      return { label: "Open", color: theme.positive };
    case QuoteLifecycle.OPTIMISTIC_CLOSE:
    case QuoteLifecycle.CLOSE_PRICE_FILLED:
      return { label: "Closing", color: theme.info };
    case QuoteLifecycle.WRITE_ONCHAIN_CLOSE:
      return { label: "Confirming", color: theme.info };
    case QuoteLifecycle.CLOSED:
      return { label: "Closed", color: theme.faint };
    case QuoteLifecycle.FAILED:
      return { label: "Failed", color: theme.negative };
    default:
      return { label: String(lifecycle), color: theme.muted };
  }
}

/** Prefer the real on-chain quote status once reconciliation has anchored a row. */
export function quoteStateMeta(quote: UnifiedQuote): { label: string; color: string } {
  if (quote.lifecycle !== QuoteLifecycle.ONCHAIN) return lifecycleMeta(quote.lifecycle);
  switch (quote.quoteStatus) {
    case QuoteStatus.PENDING:
      return { label: "Pending", color: theme.warning };
    case QuoteStatus.LOCKED:
      return { label: "Locked", color: theme.warning };
    case QuoteStatus.CANCEL_PENDING:
      return { label: "Canceling", color: theme.info };
    case QuoteStatus.OPENED:
      return { label: "Open", color: theme.positive };
    case QuoteStatus.CLOSE_PENDING:
      return { label: "Close pending", color: theme.info };
    case QuoteStatus.CANCEL_CLOSE_PENDING:
      return { label: "Canceling close", color: theme.info };
    case QuoteStatus.LIQUIDATED_PENDING:
      return { label: "Liquidating", color: theme.negative };
    default:
      return lifecycleMeta(quote.lifecycle);
  }
}
