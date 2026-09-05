import type { Address } from "viem";
import type { SymmioEnigmaNotificationsConfig, SymmioNotificationsProtocol } from "../../../core/chains";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { createReconnectingSocket } from "../../socket/create-reconnecting-socket";
import { getSocketPool } from "../../socket/get-socket-pool";
import { normalizeNotification } from "../normalize-notification";
import { parseFramePayload } from "../parse-frame-payload";
import { toNotificationsError } from "../to-notifications-error";
import type {
  EnigmaNotificationEnvelope,
  RawEnigmaPositionNotification,
  Unwatch,
  WatchNotificationsParameters,
} from "../types";

/**
 * Inputs for {@link buildSubscribeMessage}.
 */
export interface BuildSubscribeMessageParameters {
  /** SubAccount address to subscribe for. */
  account: Address;
  /** Channel / `app_name` configured for the endpoint. */
  channel: string;
  /** Wire protocol the endpoint speaks. */
  protocol: SymmioNotificationsProtocol;
}

/**
 * Build the subscribe frame to send on (re)connect for a channel-scoped
 * notifications endpoint.
 *
 * For `enigma`, this is a `channel_patterns` frame scoped to the account
 * with wildcard identifiers (every quote id for the account). The `rasa`
 * protocol does not subscribe per account-and-channel — use
 * `buildRasaSubscribeMessage` with the full address list instead.
 *
 * @returns The frame serialized as a JSON string, ready to send.
 * @throws {SymmError} for a protocol this builder does not serve.
 */
export function buildSubscribeMessage(parameters: BuildSubscribeMessageParameters): string {
  switch (parameters.protocol) {
    case "enigma":
      return JSON.stringify({
        channel_patterns: [
          {
            app_name: parameters.channel,
            address: parameters.account,
            primary_identifier: "*",
            secondary_identifier: "*",
          },
        ],
      });
    default:
      throw new SymmError(
        "config",
        "UNSUPPORTED_NOTIFICATIONS_PROTOCOL",
        `Unsupported notifications protocol: ${parameters.protocol}`,
      );
  }
}

/**
 * Parse a enigma socket frame: the notification is unwrapped from its
 * `{ data, address }` envelope and the top-level `address` is hoisted onto the
 * frame. Control/ack frames (no `data` object) and malformed payloads return
 * `null`.
 */
export function parseEnigmaNotificationFrame(data: unknown): RawEnigmaPositionNotification | null {
  const parsed = parseFramePayload(data);
  if (!parsed) return null;

  const envelope = parsed as Partial<EnigmaNotificationEnvelope>;
  const inner = envelope.data;
  // A notification frame nests its payload under `data`; control/ack frames
  // (no `data` object) are skipped. The payload itself may omit `id`.
  if (!inner || typeof inner !== "object") return null;
  return { ...inner, address: envelope.address ?? inner.address };
}

/**
 * The `enigma` transport: one pooled socket per endpoint+account, scoped
 * server-side by the channel-patterns subscribe frame sent on every
 * (re)connect.
 */
export function watchEnigmaNotifications(
  config: Config,
  notifications: SymmioEnigmaNotificationsConfig,
  parameters: WatchNotificationsParameters,
): Unwatch {
  const { account, onNotification, onStatusChange, onError } = parameters;

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
          raw = parseEnigmaNotificationFrame(data);
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
