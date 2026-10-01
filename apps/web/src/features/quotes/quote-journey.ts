import { QuoteLifecycle, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import { formatFixedPoint, formatOptionalFixedPoint } from "./quote-format";

/** A single node on a quote's provenance rail. */
export interface JourneyStage {
  key: string;
  label: string;
  detail?: string;
  tone: "done" | "current" | "failed";
}

/**
 * Build a quote's lifecycle journey from EVIDENCE, not a fixed template: a stage
 * appears only once the row demonstrably reached it (an observed temp id, a fill
 * price, an anchored-but-unread id, a confirmed on-chain struct, a close, a
 * failure). The last stage is the current state. This is what makes the
 * optimistic → writing → on-chain story legible.
 *
 * @param quote - The reconciled quote.
 * @param pricePrecision - Decimals for price details on the rail.
 * @param quantityPrecision - Decimals for quantity details on the rail.
 * @returns The stages reached so far, current last.
 */
export function buildJourney(quote: UnifiedQuote, pricePrecision: number, quantityPrecision: number): JourneyStage[] {
  const stages: JourneyStage[] = [];
  const observedOrigin = quote.tempQuoteId !== undefined || quote.raw.instantOpen !== undefined;
  if (observedOrigin) {
    stages.push({
      key: "optimistic",
      label: "Optimistic",
      detail: quote.tempQuoteId !== undefined ? `temp #${quote.tempQuoteId}` : undefined,
      tone: "done",
    });
  }
  if (quote.openedPrice !== undefined && quote.openedPrice > 0n) {
    stages.push({
      key: "price",
      label: "Price filled",
      detail: formatFixedPoint(quote.openedPrice, pricePrecision),
      tone: "done",
    });
  }
  if (quote.quoteId !== undefined && quote.raw.onchain === undefined) {
    stages.push({ key: "write-onchain", label: "Writing on-chain", detail: `#${quote.quoteId}`, tone: "done" });
  }
  if (quote.raw.onchain !== undefined) {
    stages.push({
      key: "onchain",
      label: "On-chain",
      detail: quote.quoteId !== undefined ? `#${quote.quoteId}` : undefined,
      tone: "done",
    });
  }
  /**
   * On-chain close-pending shows as ONCHAIN + quoteStatus (lifecycle no longer
   * carries a CLOSING stage), so detect it from the status too.
   */
  const closePendingOnchain =
    quote.quoteStatus === QuoteStatus.CLOSE_PENDING || quote.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING;
  const closingNow =
    quote.lifecycle === QuoteLifecycle.OPTIMISTIC_CLOSE ||
    quote.lifecycle === QuoteLifecycle.CLOSE_PRICE_FILLED ||
    quote.lifecycle === QuoteLifecycle.WRITE_ONCHAIN_CLOSE ||
    closePendingOnchain;
  if (closingNow) {
    stages.push({
      key: "close-requested",
      label: "Close requested",
      detail:
        quote.quantityToClose !== undefined ? formatFixedPoint(quote.quantityToClose, quantityPrecision) : undefined,
      tone: "done",
    });
    if (quote.avgClosedPrice !== undefined && quote.avgClosedPrice > 0n) {
      stages.push({
        key: "close-price",
        label: "Close price filled",
        detail: formatFixedPoint(quote.avgClosedPrice, pricePrecision),
        tone: "done",
      });
    }
    if (quote.lifecycle === QuoteLifecycle.WRITE_ONCHAIN_CLOSE) {
      stages.push({ key: "write-onchain-close", label: "Writing close on-chain", tone: "done" });
    }
    if (closePendingOnchain) {
      stages.push({ key: "close-pending", label: "Close pending on-chain", tone: "done" });
    }
  }
  if (quote.lifecycle === QuoteLifecycle.CLOSED) {
    stages.push({
      key: "closed",
      label: "Closed",
      detail: formatOptionalFixedPoint(quote.avgClosedPrice, pricePrecision),
      tone: "done",
    });
  }
  if (quote.lifecycle === QuoteLifecycle.FAILED) {
    stages.push({ key: "failed", label: "Failed", tone: "failed" });
  }
  if (stages.length === 0) {
    stages.push({ key: "onchain", label: "On-chain", tone: "current" });
  }
  const last = stages[stages.length - 1];
  if (last && last.tone === "done") last.tone = "current";
  return stages;
}

/**
 * Stage names the quote has **not** reached yet.
 *
 * A narrow rail cannot afford a line per unreached stage, so it collapses them
 * into one dim "then …" line. Returning the labels rather than full stages keeps
 * that honest: an unreached stage has no evidence to show.
 *
 * @param stages - Stages already reached, from {@link buildJourney}.
 * @returns Remaining stage names in order, empty once the quote is terminal.
 */
export function remainingJourneyLabels(stages: JourneyStage[]): string[] {
  const reached = new Set(stages.map((stage) => stage.key));
  if (reached.has("closed") || reached.has("failed")) return [];
  const remaining: string[] = [];
  if (!reached.has("close-requested")) remaining.push("close requested");
  remaining.push("closed");
  return remaining;
}
