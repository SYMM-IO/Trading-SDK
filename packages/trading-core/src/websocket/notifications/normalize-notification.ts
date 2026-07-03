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
 * Normalize a raw wire frame into a {@link Notification}: camelCase fields, a
 * resolved `quoteId` (on-chain id when present, else the temp id), and a
 * classified `type`.
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
    vaAddress: raw.va_address ?? null,
    counterpartyAddress: raw.counterparty_address ?? "",
    filledAmountOpen: raw.filled_amount_open ?? null,
    filledAmountClose: raw.filled_amount_close ?? null,
    avgPriceOpen: raw.avg_price_open ?? "",
    avgPriceClose: raw.avg_price_close ?? "",
    failureType: raw.failure_type ?? null,
    failureMessage: raw.failure_message ?? null,
    errorCode: raw.error_code ?? null,
    stateType: raw.state_type ?? null,
    createTime: `${raw.create_time ?? ""}`,
    modifyTime: `${raw.modify_time ?? ""}`,
    raw,
  };
}
