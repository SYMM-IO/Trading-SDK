import { ActionStatus, NotificationType, type Notification, type RawPositionNotification } from "./types";

/**
 * Classify a raw `action_status` into a {@link NotificationType}. Unknown or
 * missing statuses are treated as {@link NotificationType.FAILED}.
 *
 * @param actionStatus - The raw `action_status` field.
 */
export function classifyNotification(actionStatus: string | null): NotificationType {
  switch (actionStatus) {
    case ActionStatus.SUCCESS:
      return NotificationType.SUCCESS;
    case ActionStatus.SEEN:
      return NotificationType.SEEN;
    case ActionStatus.FAILED:
      return NotificationType.FAILED;
    default:
      return NotificationType.FAILED;
  }
}

/**
 * Reconcile a wire amount/price field to `string | null`. The enigma wire
 * sends decimal strings (or nothing); the rasa wire sends the numeric `0` for
 * "no value" and a decimal string when the frame carries one. A nonzero number
 * is kept as its string form defensively; strings pass through untouched.
 */
function wireDecimalToString(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value === 0 ? null : `${value}`;
  return value;
}

/**
 * Normalize a raw wire frame — either protocol variant — into a
 * {@link Notification}: camelCase fields, a resolved `quoteId` (on-chain id
 * when present, else the temp id), a classified `type`, and the per-wire
 * value quirks reconciled (rasa's numeric zero-sentinel amounts become
 * `null`/empty; enigma-only fields default on rasa frames). The wire-faithful
 * frame is preserved on `raw`.
 *
 * @param raw - The raw position-state frame.
 */
export function normalizeNotification(raw: RawPositionNotification): Notification {
  const resolvedQuoteId = (!raw.quote_id || raw.quote_id === 0 ? raw.temp_quote_id : raw.quote_id) || 0;

  return {
    id: raw.id ?? "",
    quoteId: `${resolvedQuoteId}`,
    tempQuoteId: raw.temp_quote_id ?? 0,
    type: classifyNotification(raw.action_status ?? null),
    actionStatus: raw.action_status ?? null,
    lastSeenAction: raw.last_seen_action ?? null,
    account: raw.address ?? null,
    vaAddress: ("va_address" in raw ? raw.va_address : null) ?? null,
    counterpartyAddress: raw.counterparty_address ?? "",
    filledAmountOpen: wireDecimalToString(raw.filled_amount_open),
    filledAmountClose: wireDecimalToString(raw.filled_amount_close),
    avgPriceOpen: wireDecimalToString(raw.avg_price_open) ?? "",
    avgPriceClose: wireDecimalToString(raw.avg_price_close) ?? "",
    failureType: raw.failure_type ?? null,
    failureMessage: ("failure_message" in raw ? raw.failure_message : null) ?? null,
    errorCode: raw.error_code ?? null,
    stateType: raw.state_type ?? null,
    createTime: `${raw.create_time ?? ""}`,
    modifyTime: `${raw.modify_time ?? ""}`,
    raw,
  };
}
