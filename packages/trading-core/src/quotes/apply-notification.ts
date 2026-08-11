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
 * Close `lastSeenAction` values that report the close price / fill request — the
 * first close notification, analogous to `InstantRFQ` on the open side. Advances a
 * closing row to {@link QuoteLifecycle.CLOSE_PRICE_FILLED}.
 */
const CLOSE_REQUEST_ACTIONS = new Set(["InstantRequestToClosePosition", "RequestToClosePosition"]);

/**
 * Close `lastSeenAction` values that report the on-chain fill — the second close
 * notification, analogous to the open-anchor actions. Advances a closing row to
 * {@link QuoteLifecycle.WRITE_ONCHAIN_CLOSE}.
 */
const CLOSE_FILL_ACTIONS = new Set(["FillMarketOrderInstantClose", "FillLimitOrderClose"]);

/**
 * All `lastSeenAction` values that belong to the closing flow (request + fill).
 */
const CLOSE_ACTIONS = new Set([...CLOSE_REQUEST_ACTIONS, ...CLOSE_FILL_ACTIONS]);

/**
 * Rank of each closing-stage lifecycle, used to advance a close monotonically and
 * to detect that a row is currently "in a close" (rank &gt; 0). Higher = further
 * along: the poll-confirmed `CLOSING` (`CLOSE_PENDING`) outranks the
 * notification-driven stages, so a replayed close notification never regresses it.
 */
const CLOSE_STAGE_RANK: Partial<Record<QuoteLifecycle, number>> = {
  [QuoteLifecycle.OPTIMISTIC_CLOSE]: 1,
  [QuoteLifecycle.CLOSE_PRICE_FILLED]: 2,
  [QuoteLifecycle.WRITE_ONCHAIN_CLOSE]: 3,
  [QuoteLifecycle.CLOSING]: 4,
};

/** The closing-stage rank of a lifecycle (0 when it is not a closing stage). */
function closeStageRank(lifecycle: QuoteLifecycle): number {
  return CLOSE_STAGE_RANK[lifecycle] ?? 0;
}

/**
 * The kind of quote action a notification reports, derived from its
 * `lastSeenAction`. Consumers use this to scope cache invalidation to the reads a
 * notification can actually affect — an open-anchor event never changes the
 * pending-instant-close feed, and vice versa.
 */
export type QuoteNotificationActionKind = "open" | "close" | "other";

/**
 * Classify a notification's `lastSeenAction` into the quote flow it belongs to.
 *
 * Open-side actions (anchoring an open, or the `InstantRFQ` price fill) classify
 * as `"open"`; close-request/fill actions classify as `"close"`; anything else
 * (including failures and unknown actions) is `"other"`.
 *
 * @param action - The notification's `lastSeenAction` (may be `null`/absent).
 * @returns The quote flow the action belongs to.
 *
 * @example
 * ```ts
 * if (classifyQuoteNotificationAction(n.lastSeenAction) === "close") invalidateCloses();
 * ```
 */
export function classifyQuoteNotificationAction(action: string | null | undefined): QuoteNotificationActionKind {
  if (!action) return "other";
  if (OPEN_ANCHOR_ACTIONS.has(action) || PRICE_FILL_ACTIONS.has(action)) return "open";
  if (CLOSE_ACTIONS.has(action)) return "close";
  return "other";
}

/**
 * Whether a notification's `lastSeenAction` is a close **fill** — the close actually
 * executed (`FillMarketOrderInstantClose` / `FillLimitOrderClose`), as opposed to a
 * close *request*. Narrower than {@link classifyQuoteNotificationAction} `=== "close"`,
 * which also matches the request. Use this to react only once the close has filled —
 * e.g. to start chasing the on-chain settle, which only begins after the fill.
 *
 * @param action - The notification's `lastSeenAction` (may be `null`/absent).
 * @returns `true` for a close-fill action, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isCloseFillAction(n.lastSeenAction)) startCloseConfirmChase(n.quoteId);
 * ```
 */
export function isCloseFillAction(action: string | null | undefined): boolean {
  return action != null && CLOSE_FILL_ACTIONS.has(action);
}

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
    /**
     * A failure is an *event*, not a durable state of a quote that exists, so we do
     * not flash `FAILED` in the common cases:
     * - a failed *action* on a confirmed on-chain row (e.g. a rejected partial
     *   close) leaves the position `OPENED` — it stays put and defers to the polled
     *   status (notifications are replayed every tick, so stamping `FAILED` here
     *   would pin a live position and block any retry);
     * - a failed *open* that never anchored simply has no quote — its optimistic row
     *   vanishes on its own once the hedger drops the pending open (active-quotes
     *   only), with no `FAILED` flicker.
     *
     * The only row we mark `FAILED` is one the chain was told anchored
     * (`origin === "onchain"`, `quoteId` set) but the read never returned
     * (`raw.onchain` absent) — a reverted anchor — so it drops out of the retained
     * anchor set instead of hanging at `WRITE_ONCHAIN` forever.
     */
    if (next.origin === "onchain" && next.raw.onchain === undefined) {
      next.lifecycle = QuoteLifecycle.FAILED;
    }
    return next;
  }
  if (n.type !== NotificationType.SUCCESS) {
    return next;
  }
  if (CLOSE_ACTIONS.has(action)) {
    if (n.avgPriceClose) {
      next.avgClosedPrice = next.avgClosedPrice ?? toWeiBigInt(n.avgPriceClose);
    }
    /**
     * Advance the close stage from the notification: the request
     * (`InstantRequestToClosePosition`) → `CLOSE_PRICE_FILLED`, the fill
     * (`FillMarketOrderInstantClose`) → `WRITE_ONCHAIN_CLOSE`.
     *
     * This only applies to a row that is **already in a closing stage** — the
     * pending-instant-close overlay (the self-clearing in-flight signal from the
     * hedger feed) puts an anchored row at `OPTIMISTIC_CLOSE` before notifications
     * run — or to a not-yet-anchored off-chain row. Once the close settles, the
     * feed drops, the overlay no longer runs, and the polled row is back at
     * `ONCHAIN` (rank 0): these **replayed** close notifications then match nothing
     * to advance, so a settled close never sticks (the bug the old `origin` guard
     * prevented). The advance is monotonic on {@link closeStageRank}, so neither a
     * replay nor the earlier request notification can regress the poll-confirmed
     * `CLOSING`.
     */
    const stage = CLOSE_FILL_ACTIONS.has(action)
      ? QuoteLifecycle.WRITE_ONCHAIN_CLOSE
      : QuoteLifecycle.CLOSE_PRICE_FILLED;
    const inClosingFlow = closeStageRank(next.lifecycle) > 0 || next.origin !== "onchain";
    if (inClosingFlow && closeStageRank(stage) > closeStageRank(next.lifecycle)) {
      next.lifecycle = stage;
    }
    return next;
  }
  if (OPEN_ANCHOR_ACTIONS.has(action)) {
    if (n.avgPriceOpen) {
      next.openedPrice = toWeiBigInt(n.avgPriceOpen);
    }
    /**
     * The notification reports the quote anchored on-chain, but the on-chain read
     * may not have returned its struct yet. Surface `WRITE_ONCHAIN` — "anchored,
     * awaiting the RPC" — until the polled struct arrives (`raw.onchain` present),
     * at which point reconciliation collapses this onto the real on-chain row and
     * its polled status wins. An already-anchored row (struct present) keeps its
     * polled lifecycle.
     */
    if (next.raw.onchain === undefined) next.lifecycle = QuoteLifecycle.WRITE_ONCHAIN;
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
 * - advances the close stage on a row already in the closing flow (or an
 *   off-chain row): the request → `CLOSE_PRICE_FILLED`, the fill →
 *   `WRITE_ONCHAIN_CLOSE`, monotonically. A settled close (polled back to
 *   `ONCHAIN`) is no longer in a closing stage, so the replayed close
 *   notifications match nothing to advance and never re-stick it;
 * - advances to `FAILED` **only for an anchored-but-unread row whose anchor reverted**
 *   (`origin === "onchain"`, `raw.onchain` absent). A failed close on a confirmed
 *   position stays put (defers to the poll), and a failed open's optimistic row just
 *   vanishes when the hedger drops it — failure is an event, not a durable state.
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
