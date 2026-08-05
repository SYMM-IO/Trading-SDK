import type { Config } from "../../core/config";
import { watchEnigmaNotifications } from "./adapters/enigma-notifications";
import { watchRasaNotifications } from "./adapters/rasa-notifications";
import type { Unwatch, WatchNotificationsParameters } from "./types";

/**
 * Subscribe to live position/quote state notifications for an account.
 *
 * Opens (or reuses) one reconnecting socket to the chain's notifications
 * endpoint, sends the subscribe frame on every (re)connect, normalizes inbound
 * frames into `Notification`s, and invokes the handlers. Thin protocol
 * dispatch — each protocol's subscribe, parse, and socket-sharing story lives
 * in its adapter:
 *
 * - `enigma`: watchers sharing the same endpoint+account share one socket.
 * - `rasa`: watchers multiplex every account onto one socket per endpoint (the
 *   subscribe frame carries the full address list).
 *
 * Either way, the socket closes when the last watcher unwatches.
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
  const { notifications } = config.getChainConfig(parameters.chainId);
  switch (notifications.protocol) {
    case "enigma":
      return watchEnigmaNotifications(config, notifications, parameters);
    case "rasa":
      return watchRasaNotifications(config, notifications, parameters);
  }
}
