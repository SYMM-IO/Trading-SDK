import type { Address } from "viem";
import type { SolverId } from "../../core/chains";
import type { SymmError } from "../../shared/errors/symm-error";
import type { SocketStatus } from "../socket/socket-status";

/**
 * Stop a {@link watchNotifications} subscription. Idempotent; the shared socket
 * closes once the last watcher on an endpoint releases.
 */
export type Unwatch = () => void;

/**
 * Parameters for `watchNotifications`.
 */
export interface WatchNotificationsParameters {
  /** SubAccount address to subscribe for. */
  account: Address;
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Target solver. Defaults to the chain's default solver; selects the notifications endpoint + protocol. */
  solverId?: SolverId;
  /** Called for every normalized notification frame. */
  onNotification: (notification: Notification) => void;
  /** Called whenever the underlying connection status changes. */
  onStatusChange?: (status: SocketStatus) => void;
  /** Called on a transport or parse error; does not stop the subscription. */
  onError?: (error: SymmError) => void;
}

/**
 * Fields every notifications wire returns, snake_case as they arrive. The
 * endpoints omit fields that do not apply to a given frame (e.g. an
 * `InstantRFQ` report carries no `id`), so almost every field is optional;
 * {@link normalizeNotification} fills sensible defaults and reconciles the
 * per-wire value quirks.
 *
 * Amount/price fields are typed to the **widest** wire form here (`number |
 * string | null`) because that is what covers every wire: the rasa endpoint
 * sends a numeric `0` for "no value", the enigma endpoint only ever sends a
 * decimal string. Only fields **exclusive** to one wire live on the variants
 * below.
 */
interface RawPositionNotificationBase {
  id?: string;
  /** On-chain quote id — `0` (enigma) or the negative temp id (rasa) while the order is still off-chain. */
  quote_id?: number;
  /** Negative placeholder id assigned before the on-chain quote id exists. */
  temp_quote_id?: number;
  create_time?: number;
  modify_time?: number;
  counterparty_address?: string;
  /**
   * SubAccount address the notification belongs to. On the enigma wire it is
   * hoisted from the envelope; rasa frames do not carry it — the watcher
   * stamps it from its own subscription.
   */
  address?: string;
  /**
   * Filled base amount on the open leg. Decimal string when present (enigma
   * always; rasa on a `report`); numeric `0` on a rasa `alert` duplicate;
   * absent/`null` otherwise. Same for the three fields below.
   */
  filled_amount_open?: number | string | null;
  filled_amount_close?: number | string | null;
  avg_price_open?: number | string | null;
  avg_price_close?: number | string | null;
  /** Last solver action seen for this quote (e.g. `SendQuoteTransaction`). */
  last_seen_action?: string | null;
  /** `success` | `failed` | `seen`. */
  action_status?: string | null;
  failure_type?: string | null;
  error_code?: number | null;
  /** `report` | `alert`. */
  state_type?: string | null;
}

/**
 * Raw frame as the enigma (channel-scoped) endpoint sends it, after the
 * `{ data, address }` envelope unwrap. Adds the fields only this wire carries;
 * on this wire the shared amount/price fields are always decimal strings (or
 * `null`/absent), never numbers.
 */
export interface RawEnigmaPositionNotification extends RawPositionNotificationBase {
  /** Solver-assigned Virtual Account address (lowcap), when present. */
  va_address?: string;
  failure_message?: string | null;
  version?: number;
}

/**
 * Raw frame as the rasa position-state endpoint sends it, bare (no envelope).
 * Wire quirks, preserved as-is (the shared {@link normalizeNotification}
 * reconciles them):
 *
 * - the shared amount/price fields are the numeric `0` when the frame carries
 *   no value (an `alert` duplicate) and a decimal **string** when it does (a
 *   `report`);
 * - there is no `address` / `va_address` on the wire — the SubAccount arrives
 *   as `counterparty_address` only, and `quote_id` equals the negative
 *   `temp_quote_id` until the on-chain id is assigned.
 */
export interface RawRasaPositionNotification extends RawPositionNotificationBase {
  /** Order type discriminant the rasa wire attaches (e.g. `1`). */
  order_type?: number;
}

/**
 * Raw position-state notification frame as it arrives on the wire — one
 * variant per notifications protocol. Consumers normally receive the
 * normalized {@link Notification}; the wire-faithful frame is retained on it
 * as `raw`.
 */
export type RawPositionNotification = RawEnigmaPositionNotification | RawRasaPositionNotification;

/**
 * Envelope used by the `enigma` endpoint: the notification is nested under
 * `data`, with the SubAccount address hoisted to the top level.
 */
export interface EnigmaNotificationEnvelope {
  data: RawEnigmaPositionNotification;
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
