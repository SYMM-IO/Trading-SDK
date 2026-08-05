import type { SymmioRasaNotificationsConfig } from "../../../core/chains";
import type { Config } from "../../../core/config";
import { normalizeNotification } from "../normalize-notification";
import { parseFramePayload } from "../parse-frame-payload";
import { toNotificationsError } from "../to-notifications-error";
import type { RawRasaPositionNotification, Unwatch, WatchNotificationsParameters } from "../types";
import { acquireRasaNotificationsSocket } from "./rasa-notifications-hub";

/**
 * Parse a rasa position-state socket frame into a wire-faithful
 * {@link RawRasaPositionNotification}: frames arrive bare (no envelope) and
 * are kept as sent — the numeric zero-sentinel amount/price fields are
 * reconciled later by the shared `normalizeNotification`. `address` /
 * `va_address` are absent on this wire — the watcher stamps the SubAccount
 * from its own subscription, since the frame only carries
 * `counterparty_address`. Frames without either quote id (acks, keepalives)
 * return `null`.
 */
export function parseRasaNotificationFrame(data: unknown): RawRasaPositionNotification | null {
  const parsed = parseFramePayload(data);
  if (!parsed) return null;

  const frame = parsed as RawRasaPositionNotification;
  // A notification frame always names its quote; frames without either id
  // (acks, keepalives) are skipped.
  if (frame.quote_id === undefined && frame.temp_quote_id === undefined) return null;
  return frame;
}

/**
 * The `rasa` transport: every watcher multiplexes onto one shared socket per
 * endpoint, so the shared frames must be filtered per watcher — a frame is
 * this watcher's when its `counterparty_address` is the subscribed account.
 * The wire carries no `address` field, so the account is stamped from the
 * subscription before normalizing, giving consumers the same
 * `notification.account` they get from `enigma`.
 */
export function watchRasaNotifications(
  config: Config,
  notifications: SymmioRasaNotificationsConfig,
  parameters: WatchNotificationsParameters,
): Unwatch {
  const { account, onNotification, onStatusChange, onError } = parameters;
  const accountKey = account.toLowerCase();

  return acquireRasaNotificationsSocket(config, {
    url: notifications.url,
    account,
    listener: {
      onMessage: (data) => {
        let raw;
        try {
          raw = parseRasaNotificationFrame(data);
        } catch (err) {
          onError?.(toNotificationsError(err));
          return;
        }
        if (!raw) return;
        // Shared socket: drop the other subscribed accounts' frames.
        if ((raw.counterparty_address ?? "").toLowerCase() !== accountKey) return;
        try {
          onNotification(normalizeNotification({ ...raw, address: account }));
        } catch (err) {
          onError?.(toNotificationsError(err));
        }
      },
      onStatusChange,
      onError: (event) => onError?.(toNotificationsError(event)),
    },
  });
}
