import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { acquireEnigmaNotificationEnvelopes } from "./adapters/enigma-notifications-hub";
import type { Unwatch, WatchNotificationEnvelopesParameters } from "./types";

/**
 * Watch full server envelopes for multiple accounts and channels over one shared
 * Enigma connection. This preserves the existing wire format, including listing
 * and transfer metadata. Position subscriptions use their own account/channel scope.
 *
 * @param config - Deployment configuration and injected WebSocket implementation.
 * @param parameters - Subscriptions and callbacks; empty subscriptions remain idle.
 * @returns Idempotent cleanup. The last subscriber closes the connection.
 * @throws {SymmError} When the deployment does not use Enigma notifications.
 * @example
 * ```ts
 * const stop = watchNotificationEnvelopes(config, {
 *   chainId: 42161, solverId: "enigma",
 *   subscriptions: [{ account, channel }],
 *   onEnvelope: (event) => console.log(event.app_name, event.data),
 * });
 * stop();
 * ```
 */
export function watchNotificationEnvelopes(config: Config, parameters: WatchNotificationEnvelopesParameters): Unwatch {
  const { notifications } = config.getSolver(parameters);
  if (notifications.protocol !== "enigma") {
    throw new SymmError(
      "config",
      "UNSUPPORTED_NOTIFICATIONS_PROTOCOL",
      "Notification envelopes require the Enigma protocol.",
    );
  }
  return acquireEnigmaNotificationEnvelopes(config, notifications.url, parameters);
}
