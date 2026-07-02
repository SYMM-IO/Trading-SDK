import type { RawTpSlNotification, TpSlNotification } from "./types";

/**
 * Parse a raw defilytics frame into a {@link TpSlNotification}, or `null` when
 * the frame isn't a `report` (control frames, malformed JSON, missing payload,
 * wrong shape).
 *
 * Wire shape (single-wrapped — the `data` field IS the payload, not a nested
 * envelope):
 *
 * ```jsonc
 * {
 *   "app_name": "Hyper-EVM_COH-Low-Cap_Production",
 *   "primary_identifier": 9565,
 *   "secondary_identifier": 0,
 *   "address": "0xaE96…",
 *   "type": "report",
 *   "timestamp": 1782821982,
 *   "data": { coh_quote_id, conditional_order_type, state, details, successful }
 * }
 * ```
 */
export function parseTpSlFrame(data: unknown): TpSlNotification | null {
  const envelope = normalizeEnvelope(data);
  if (!envelope) return null;
  if (envelope.type && envelope.type !== "report") return null;

  const payload = envelope.data;
  if (!payload) return null;

  const primary = Number(envelope.primary_identifier ?? 0);
  const secondary = Number(envelope.secondary_identifier ?? 0);
  const quoteId = primary !== 0 ? primary : secondary;

  const base = {
    quoteId,
    primaryIdentifier: primary,
    secondaryIdentifier: secondary,
    account: envelope.address ?? null,
    conditionalOrderType: payload.conditional_order_type ?? null,
    state: payload.state,
    cohQuoteId: payload.coh_quote_id,
    timestamp: typeof envelope.timestamp === "number" ? envelope.timestamp : undefined,
    raw: envelope,
  } as const;

  if (payload.successful) {
    return { ...base, successful: true, details: payload.details };
  }
  return {
    ...base,
    successful: false,
    errorCode: payload.error_code,
    errorMessage: payload.error_message,
  };
}

/**
 * Narrow arbitrary input (raw ws `event.data`, JSON string, or already-parsed
 * object) into a typed {@link RawTpSlNotification}, or `null` if it can't be
 * safely treated as one.
 *
 * The runtime is best-effort — the WS server owns the shape and we only trust
 * the outer envelope; the payload is walked through the union type
 * ({@link RawTpSlNotification.data}) after.
 */
function normalizeEnvelope(data: unknown): RawTpSlNotification | null {
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return isEnvelope(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isEnvelope(data) ? data : null;
}

function isEnvelope(value: unknown): value is RawTpSlNotification {
  return typeof value === "object" && value !== null;
}
