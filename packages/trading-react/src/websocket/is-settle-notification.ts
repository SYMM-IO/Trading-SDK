import { NotificationType, type Notification } from "@symmio/trading-core";

/**
 * Solver actions that mean a position settled on-chain — an open anchored
 * (margin locked) or a close filled (PnL realized, margin unlocked). These are
 * the frames that move a subaccount's balance; the earlier request / price-fill
 * frames do not. Mirrors core's `OPEN_ANCHOR_ACTIONS` ∪ `CLOSE_FILL_ACTIONS`.
 */
const SETTLE_ACTIONS = new Set<string>(["SendQuoteTransaction", "FillMarketOrderInstantClose"]);

/**
 * `true` when a notification marks an on-chain settle — a `SUCCESS` frame whose
 * `lastSeenAction` is an open-anchor or close-fill. Live balance reads refetch
 * on exactly these.
 */
export function isSettleNotification(notification: Notification): boolean {
  return (
    notification.type === NotificationType.SUCCESS &&
    notification.lastSeenAction !== null &&
    SETTLE_ACTIONS.has(notification.lastSeenAction)
  );
}

/**
 * Delays (ms) at which a live balance read refetches after a settle
 * notification. The on-chain read lags the anchor block, so a single immediate
 * read often returns the pre-settle value; a short spaced burst lets the updated
 * balance land without a manual refresh.
 */
export const SETTLE_REFETCH_DELAYS_MS = [0, 2000, 5000] as const;
