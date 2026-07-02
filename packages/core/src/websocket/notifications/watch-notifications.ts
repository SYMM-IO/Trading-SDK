import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { createReconnectingSocket } from "../socket/create-reconnecting-socket";
import { getSocketPool } from "../socket/get-socket-pool";
import type { SocketStatus } from "../socket/socket-status";
import { buildSubscribeMessage } from "./build-subscribe-message";
import { normalizeNotification } from "./normalize-notification";
import { parseNotificationFrame } from "./parse-notification-frame";
import type { Notification } from "./types";

/**
 * Stop a {@link watchNotifications} subscription. Idempotent; the shared socket
 * closes once the last watcher on an endpoint+account releases.
 */
export type Unwatch = () => void;

/**
 * Parameters for {@link watchNotifications}.
 */
export interface WatchNotificationsParameters {
  /** SubAccount address to subscribe for. */
  account: Address;
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Called for every normalized notification frame. */
  onNotification: (notification: Notification) => void;
  /** Called whenever the underlying connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport or parse error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

function toNotificationsError(event: unknown): SymmError {
  if (event instanceof SymmError) return event;
  const cause = event instanceof Error ? event : undefined;
  return new SymmError(
    "api",
    "NOTIFICATIONS_SOCKET_ERROR",
    `Notifications socket error${cause ? `: ${cause.message}` : "."}`,
    {
      cause,
    },
  );
}

/**
 * Subscribe to live position/quote state notifications for an account.
 *
 * Opens (or reuses) one reconnecting socket to the chain's notifications
 * endpoint, sends the subscribe frame on every (re)connect, normalizes inbound
 * frames into {@link Notification}s, and invokes the handlers. Watchers sharing
 * the same endpoint+account share one socket; it closes when the last one
 * unwatches.
 *
 * @param config - The SDK config.
 * @param parameters - The account to watch and the handlers to invoke.
 * @returns An unwatch function that releases this subscription.
 * @throws {SymmError} synchronously when the chain is unsupported or no
 *   `WebSocket` implementation is available.
 *
 * @example
 * ```ts
 * const unwatch = watchNotifications(config, {
 *   account: "0xabc…",
 *   onNotification: (n) => console.log(n.type, n.quoteId),
 *   onStatusChange: (status) => console.log(status),
 * });
 * // later
 * unwatch();
 * ```
 */
export function watchNotifications(config: Config, parameters: WatchNotificationsParameters): Unwatch {
  const { account, chainId, onNotification, onStatusChange, onError } = parameters;

  const { notifications } = config.getChainConfig(chainId);
  const webSocketConstructor = config.getWebSocketConstructor();
  const subscribeMessage = buildSubscribeMessage({
    account,
    channel: notifications.channel,
    protocol: notifications.protocol,
  });

  const key = `${notifications.url}|${notifications.protocol}|${account.toLowerCase()}`;

  return getSocketPool(config).acquire(
    key,
    (handlers) =>
      createReconnectingSocket({
        url: notifications.url,
        webSocketConstructor,
        getOpenMessages: () => [subscribeMessage],
        onMessage: handlers.onMessage,
        onStatusChange: handlers.onStatusChange,
        onError: handlers.onError,
      }),
    {
      onMessage: (data) => {
        let raw;
        try {
          raw = parseNotificationFrame(data, notifications.protocol);
        } catch (err) {
          onError?.(toNotificationsError(err));
          return;
        }
        if (!raw) return;
        try {
          onNotification(normalizeNotification(raw));
        } catch (err) {
          onError?.(toNotificationsError(err));
        }
      },
      onStatusChange,
      onError: (event) => onError?.(toNotificationsError(event)),
    },
  );
}
