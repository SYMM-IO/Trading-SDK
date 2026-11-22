import type { Config } from "../../core/config";
import type { EnigmaNotificationFrame, WatchNotificationEnvelopesParameters } from "./types";
import { watchNotificationEnvelopes } from "./watch-notification-envelopes";
const kinds = [
  "deposit_received",
  "deposit_finalized",
  "pool_created",
  "pool_creation_failed",
  "insufficient_deposit",
] as const;
/** A listing lifecycle event emitted for the subscribed account. */
export interface ListingNotification {
  kind: (typeof kinds)[number];
  account: string;
  channel: string;
  marketId?: string;
  eventId?: string;
}
/** Map a listing document to stable fields. Unknown event kinds are ignored. */
export function normalizeListingNotification(frame: EnigmaNotificationFrame): ListingNotification | undefined {
  const data = frame.data;
  const kind = kinds.find((k) =>
    [data.event, data.last_seen_action, data.event_type, data.notification_event].includes(k),
  );
  if (!kind) return;
  const market = data.market_id ?? frame.secondary_identifier;
  const id = data.id ?? frame.id;
  return {
    kind,
    account: frame.address,
    channel: frame.app_name,
    marketId: typeof market === "number" || typeof market === "string" ? String(market) : undefined,
    eventId: typeof id === "string" ? id : undefined,
  };
}
/** Accounts and listing channels to observe and their normalized event callback. */
export type WatchListingNotificationsParameters = Omit<WatchNotificationEnvelopesParameters, "onEnvelope"> & {
  onNotification: (event: ListingNotification) => void;
};
/** Subscribe to listing lifecycle updates. Returns the unsubscribe function.
 * @example const stop = watchListingNotifications(config, {subscriptions:[{account,channel}],onNotification:console.log});
 */
export function watchListingNotifications(
  config: Config,
  { onNotification, ...options }: WatchListingNotificationsParameters,
) {
  return watchNotificationEnvelopes(config, {
    ...options,
    onEnvelope: (frame) => {
      const event = normalizeListingNotification(frame);
      if (event) onNotification(event);
    },
  });
}
