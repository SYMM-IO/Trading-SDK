import type { SymmioNotificationsProtocol } from "../../core/chains";
import type { DefilyticsNotificationEnvelope, RawPositionNotification } from "./types";

/**
 * Parse an inbound socket frame into a {@link RawPositionNotification}, or
 * `null` when the frame is not a notification (control/ack frames, malformed
 * JSON, or a missing payload — all skipped silently by the caller).
 *
 * For `defilytics`, the notification is unwrapped from its `{ data, address }`
 * envelope and the top-level `address` is hoisted onto the frame.
 *
 * @param data - The raw `event.data` (a JSON string, or an already-parsed object).
 * @param protocol - The endpoint's wire protocol.
 */
export function parseNotificationFrame(
  data: unknown,
  protocol: SymmioNotificationsProtocol,
): RawPositionNotification | null {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;

  if (protocol === "defilytics") {
    const envelope = parsed as Partial<DefilyticsNotificationEnvelope>;
    const inner = envelope.data;
    // A notification frame nests its payload under `data`; control/ack frames
    // (no `data` object) are skipped. The payload itself may omit `id`.
    if (!inner || typeof inner !== "object") return null;
    return { ...inner, address: envelope.address ?? inner.address };
  }

  // Non-enveloped protocols deliver the notification frame directly.
  return parsed as RawPositionNotification;
}
