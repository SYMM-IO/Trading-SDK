import { toWeiBigInt } from "../solvers/instant-open/shared/trade-math";
import { NotificationType, type Notification } from "../websocket/notifications/types";
import { QuoteLifecycle, type UnifiedQuote } from "./unified-quote";

/**
 * Solver `lastSeenAction` values that, on success, anchor a quote on-chain.
 */
const OPEN_ANCHOR_ACTIONS = new Set(["SendQuoteTransaction", "SendQuote", "FillLimitOrderOpen"]);

/**
 * Solver `lastSeenAction` values that report a fill price while the trade is
 * still off-chain (the optimistic row gets a price before its on-chain id lands).
 */
const PRICE_FILL_ACTIONS = new Set(["InstantRFQ"]);

/**
 * Solver `lastSeenAction` values that move a quote into the closing/closed flow.
 */
const CLOSE_ACTIONS = new Set([
  "InstantRequestToClosePosition",
  "RequestToClosePosition",
  "FillMarketOrderInstantClose",
  "FillLimitOrderClose",
]);

/**
 * Decide whether a notification refers to a given unified row, matching first by
 * on-chain quote id and then by the pre-chain temp id.
 */
function notificationMatchesQuote(quote: UnifiedQuote, n: Notification): boolean {
  if (quote.quoteId !== undefined && n.quoteId === `${quote.quoteId}`) return true;
  if (quote.tempQuoteId !== undefined && quote.tempQuoteId === n.tempQuoteId) return true;
  return false;
}

/**
 * Apply one notification to a single matched {@link UnifiedQuote}, returning a
 * new row with the linked ids, filled prices, and advanced lifecycle.
 */
function applyToMatched(quote: UnifiedQuote, n: Notification): UnifiedQuote {
  const next: UnifiedQuote = { ...quote };
  const onchainId = n.quoteId && n.quoteId !== `${n.tempQuoteId}` ? BigInt(n.quoteId) : undefined;
  if (onchainId !== undefined && next.quoteId === undefined) {
    next.quoteId = onchainId;
    next.key = `onchain:${onchainId}`;
    next.origin = "onchain";
  }
  if (next.tempQuoteId === undefined && n.tempQuoteId !== 0) {
    next.tempQuoteId = n.tempQuoteId;
  }
  if (n.vaAddress) {
    next.vaAddress = n.vaAddress as UnifiedQuote["vaAddress"];
  }
  const action = n.lastSeenAction ?? "";
  if (n.type === NotificationType.FAILED) {
    next.lifecycle = QuoteLifecycle.FAILED;
    return next;
  }
  if (n.type !== NotificationType.SUCCESS) {
    return next;
  }
  if (CLOSE_ACTIONS.has(action)) {
    if (n.avgPriceClose) {
      next.closedPrice = next.closedPrice ?? toWeiBigInt(n.avgPriceClose);
    }
    next.lifecycle = next.lifecycle === QuoteLifecycle.CLOSED ? QuoteLifecycle.CLOSED : QuoteLifecycle.CLOSING;
    return next;
  }
  if (OPEN_ANCHOR_ACTIONS.has(action)) {
    if (n.avgPriceOpen) {
      next.openedPrice = toWeiBigInt(n.avgPriceOpen);
    }
    next.lifecycle = QuoteLifecycle.ONCHAIN;
    return next;
  }
  if (PRICE_FILL_ACTIONS.has(action)) {
    if (n.avgPriceOpen) {
      next.openedPrice = toWeiBigInt(n.avgPriceOpen);
    }
    next.lifecycle = next.origin === "onchain" ? next.lifecycle : QuoteLifecycle.PRICE_FILLED;
    return next;
  }
  return next;
}

/**
 * Apply a single notification to a list of {@link UnifiedQuote}s, returning a new
 * list (pure — inputs are never mutated).
 *
 * The notification is matched to a row by on-chain quote id, falling back to the
 * pre-chain temp id, which is how an optimistic row gets linked to its on-chain
 * quote (`temp:<id>` → `onchain:<id>`). On the matched row it:
 *
 * - links `tempQuoteId` ↔ `quoteId` and rekeys it once the on-chain id appears;
 * - fills `openedPrice` and advances to `PRICE_FILLED` on `InstantRFQ` success;
 * - advances to `ONCHAIN` on `SendQuoteTransaction` (open-anchor) success;
 * - advances to `CLOSING` / keeps `CLOSED` on close-action success;
 * - advances to `FAILED` on any failure notification.
 *
 * @param quotes - The current unified rows.
 * @param n - The normalized notification to apply.
 * @returns A new list with the matched row updated; the same list (by content) when nothing matched.
 *
 * @example
 * ```ts
 * const next = applyNotificationToQuotes(quotes, notification);
 * ```
 */
export function applyNotificationToQuotes(quotes: UnifiedQuote[], n: Notification): UnifiedQuote[] {
  return quotes.map((quote) => (notificationMatchesQuote(quote, n) ? applyToMatched(quote, n) : quote));
}
