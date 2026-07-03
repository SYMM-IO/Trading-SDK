/**
 * Raw position-state notification frame as it arrives on the wire (snake_case),
 * mirroring the hedger/solver payload. Consumers normally receive the
 * normalized {@link Notification}; the raw frame is retained on it as `raw`.
 *
 * The endpoint omits fields that do not apply to a given frame (e.g. an
 * `InstantRFQ` report carries no `id`), so almost every field is optional;
 * {@link normalizeNotification} fills sensible defaults.
 */
export interface RawPositionNotification {
  id?: string;
  /** On-chain quote id, or `0` while the order is still off-chain. */
  quote_id?: number;
  /** Negative placeholder id assigned before the on-chain quote id exists. */
  temp_quote_id?: number;
  create_time?: number;
  modify_time?: number;
  counterparty_address?: string;
  /** SubAccount address the notification belongs to. */
  address?: string;
  /** Solver-assigned Virtual Account address (lowcap), when present. */
  va_address?: string;
  filled_amount_open?: string | null;
  filled_amount_close?: string | null;
  /** Last solver action seen for this quote (e.g. `SendQuoteTransaction`). */
  last_seen_action?: string | null;
  /** `success` | `failed` | `seen`. */
  action_status?: string | null;
  failure_type?: string | null;
  failure_message?: string | null;
  error_code?: number | null;
  /** `report` | `alert`. */
  state_type?: string | null;
  version?: number;
  avg_price_open?: string;
  avg_price_close?: string;
}

/**
 * Envelope used by the `defilytics` endpoint: the notification is nested under
 * `data`, with the SubAccount address hoisted to the top level.
 */
export interface DefilyticsNotificationEnvelope {
  data: RawPositionNotification;
  address: string;
}

/**
 * The `action_status` values a notification can carry.
 */
export enum ActionStatus {
  SUCCESS = "success",
  FAILED = "failed",
  SEEN = "seen",
}

/**
 * Classification of a notification, derived from its {@link ActionStatus}.
 * Unknown statuses are treated as {@link NotificationType.FAILED}.
 */
export enum NotificationType {
  SUCCESS = "success",
  FAILED = "failed",
  SEEN = "seen",
}

/**
 * A normalized, classified notification the SDK delivers to consumers.
 *
 * camelCase, with `quoteId` resolved to the on-chain id when available (falling
 * back to the temp id), and `type` classified from `actionStatus`. The original
 * wire frame is preserved on `raw` for advanced use.
 */
export interface Notification {
  id: string;
  /** On-chain quote id as a string, or the temp id when no on-chain id exists yet. */
  quoteId: string;
  /** The temp (pre-chain) quote id; negative until the on-chain id is assigned. */
  tempQuoteId: number;
  /** Classification derived from {@link Notification.actionStatus}. */
  type: NotificationType;
  /** Raw `action_status` (`success` | `failed` | `seen`), or `null`. */
  actionStatus: string | null;
  /** Last solver action seen for this quote. */
  lastSeenAction: string | null;
  /** SubAccount address this notification belongs to. */
  account: string | null;
  /** Solver-assigned Virtual Account address (lowcap), when present. */
  vaAddress: string | null;
  counterpartyAddress: string;
  filledAmountOpen: string | null;
  filledAmountClose: string | null;
  avgPriceOpen: string;
  avgPriceClose: string;
  failureType: string | null;
  failureMessage: string | null;
  errorCode: number | null;
  stateType: string | null;
  createTime: string;
  modifyTime: string;
  /** The original wire frame. */
  raw: RawPositionNotification;
}
