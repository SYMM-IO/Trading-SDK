import type { RawPositionNotification } from "../websocket/notifications/types";

/**
 * A scalar the notification search backend matches by exact equality. The
 * `POST /api/v1/search` endpoint treats every `query` entry as an equality
 * filter; it defines no range/operator syntax, so values are plain scalars.
 */
export type NotificationQueryValue = string | number | boolean | null;

/**
 * Top-level searchable fields on a stored notification document. These sit at
 * the document root (alongside `data`), not inside the payload.
 */
export type NotificationSearchTopLevelField =
  | "id"
  | "app_name"
  | "address"
  | "primary_identifier"
  | "secondary_identifier"
  | "type"
  | "create_time"
  | "modify_time";

/**
 * Dotted path into a notification's nested `data` payload, e.g.
 * `"data.temp_quote_id"`. Derived from {@link RawPositionNotification} so the
 * autocomplete suggestions track the position wire frame instead of drifting
 * out of sync with a hand-maintained list.
 */
export type NotificationDataKey = `data.${Extract<keyof RawPositionNotification, string>}`;

/**
 * Every key the search backend is known to understand: a top-level field or a
 * dotted `data.*` path. Used to seed autocomplete on {@link NotificationSearchFilter}.
 */
export type NotificationSearchField = NotificationSearchTopLevelField | NotificationDataKey;

/**
 * Free-form equality filter for {@link searchNotifications}. Every key/value
 * pair is matched exactly against the stored document.
 *
 * Known top-level fields and every `data.*` payload field are offered as
 * editor autocomplete, but **any** string key is still accepted — app-specific
 * payloads carry fields the SDK does not enumerate, and the endpoint matches
 * them all the same.
 *
 * @example
 * ```ts
 * const filter: NotificationSearchFilter = {
 *   app_name: "Base_Superflow_Stage",
 *   "data.temp_quote_id": -172,
 * };
 * ```
 */
export type NotificationSearchFilter = Partial<Record<NotificationSearchField, NotificationQueryValue>> &
  Record<string, NotificationQueryValue>;

/**
 * A stored notification document as returned by the search endpoint.
 *
 * Only the well-known top-level fields are typed; the index signature keeps
 * app-specific fields reachable. For trading notifications the `data` payload
 * is the position wire frame ({@link RawPositionNotification}).
 */
export interface NotificationDocument {
  id?: string;
  /** Publishing app / channel identity, e.g. `"Hyper-EVM_Solver-Low-Cap_Production"`. */
  app_name?: string;
  /** SubAccount address the notification belongs to. */
  address?: string;
  primary_identifier?: number;
  secondary_identifier?: string | number | null;
  /** `report` | `alert`. */
  type?: string;
  create_time?: number;
  modify_time?: number;
  /** App-specific payload; the position wire frame for trading notifications. */
  data?: RawPositionNotification & Record<string, unknown>;
  [key: string]: unknown;
}
