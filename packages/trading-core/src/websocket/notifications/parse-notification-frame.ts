import type { SymmioNotificationsProtocol } from "../../core/chains";
import { parseEnigmaNotificationFrame } from "./adapters/enigma-notifications";
import { parseRasaNotificationFrame } from "./adapters/rasa-notifications";
import type { RawEnigmaPositionNotification, RawPositionNotification, RawRasaPositionNotification } from "./types";

/**
 * Parse an inbound socket frame into the protocol's wire-faithful
 * {@link RawPositionNotification} variant, or `null` when the frame is not a
 * notification (control/ack frames, malformed JSON, or a missing payload — all
 * skipped silently by the caller). A literal `protocol` narrows the return to
 * that protocol's variant.
 *
 * Thin protocol dispatch — each protocol's quirks live in its adapter. For
 * `enigma`, the notification is unwrapped from its `{ data, address }`
 * envelope and the top-level `address` is hoisted onto the frame. For `rasa`,
 * the frame arrives bare and is kept as sent (numeric zero-sentinels included
 * — `normalizeNotification` reconciles them).
 *
 * @param data - The raw `event.data` (a JSON string, or an already-parsed object).
 * @param protocol - The endpoint's wire protocol.
 */
export function parseNotificationFrame(data: unknown, protocol: "enigma"): RawEnigmaPositionNotification | null;
export function parseNotificationFrame(data: unknown, protocol: "rasa"): RawRasaPositionNotification | null;
export function parseNotificationFrame(
  data: unknown,
  protocol: SymmioNotificationsProtocol,
): RawPositionNotification | null;
export function parseNotificationFrame(
  data: unknown,
  protocol: SymmioNotificationsProtocol,
): RawPositionNotification | null {
  switch (protocol) {
    case "enigma":
      return parseEnigmaNotificationFrame(data);
    case "rasa":
      return parseRasaNotificationFrame(data);
  }
}
