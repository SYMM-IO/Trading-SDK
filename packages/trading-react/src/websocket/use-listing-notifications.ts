"use client";
import { normalizeListingNotification, type ListingNotification } from "@symmio/trading-core";
import { useNotificationEnvelopes, type UseNotificationEnvelopesParameters } from "./use-notification-envelopes";
/** Listing subscriptions with React lifecycle controls. */
export type UseListingNotificationsParameters = Omit<UseNotificationEnvelopesParameters, "onEnvelope"> & {
  onNotification: (event: ListingNotification) => void;
};
/** Subscribe to listing events for the configured account/channel pairs.
 * @example useListingNotifications({subscriptions:[{account,channel}],onNotification:console.log});
 */
export function useListingNotifications({ onNotification, ...options }: UseListingNotificationsParameters) {
  return useNotificationEnvelopes({
    ...options,
    onEnvelope: (frame) => {
      const event = normalizeListingNotification(frame);
      if (event) onNotification(event);
    },
  });
}
