import type { TpSlConditionalOrderType } from "../../tpsl/types";

/**
 * Wire shape of one report frame from the TP/SL notifications WS, after the
 * defilytics envelope is unwrapped.
 */
export interface RawTpSlNotification {
  app_name?: string;
  primary_identifier?: number;
  secondary_identifier?: number;
  address?: string;
  type?: "report" | "alarm";
  timestamp?: number;
  data?: RawTpSlNotificationData;
}

export type RawTpSlNotificationState =
  | "new"
  | "edit"
  | "pending"
  | "cancelled"
  | "canceled"
  | "cancel"
  | "triggered"
  | "trigger"
  | "close";

export interface RawTpSlNotificationDetails {
  close_price?: number;
  quantity_to_close?: number;
  open_price?: number;
  trigger_price?: number;
}

export type RawTpSlNotificationData =
  | {
      successful: true;
      coh_quote_id?: string;
      conditional_order_type: TpSlConditionalOrderType;
      state: RawTpSlNotificationState;
      details?: RawTpSlNotificationDetails;
    }
  | {
      successful: false;
      coh_quote_id?: string;
      conditional_order_type?: TpSlConditionalOrderType;
      state: RawTpSlNotificationState;
      error_code?: number;
      status_code?: number;
      error_message?: string;
    };

/**
 * Normalized TP/SL notification the SDK delivers to consumers.
 *
 * `quoteId` resolves to the on-chain id (from `primary_identifier`) when the
 * quote anchored; while still off-chain the handler reports `0` there and
 * carries the temp id on `secondary_identifier`.
 */
export interface TpSlNotification {
  /** On-chain quote id when known; falls back to the temp id (may be negative). */
  quoteId: number;
  /** Always the raw `primary_identifier` (`0` while pre-chain). */
  primaryIdentifier: number;
  /** Always the raw `secondary_identifier` (the temp id pre-chain). */
  secondaryIdentifier: number;
  /** SubAccount address the notification belongs to. */
  account: string | null;
  conditionalOrderType: TpSlConditionalOrderType | null;
  state: RawTpSlNotificationState;
  successful: boolean;
  cohQuoteId?: string;
  /** Set on `close` frames — the fill details from the handler. */
  details?: RawTpSlNotificationDetails;
  /** Set when `successful: false`. */
  errorCode?: number;
  errorMessage?: string;
  /** Frame timestamp (seconds), when present. */
  timestamp?: number;
  /** Raw decoded payload. */
  raw: RawTpSlNotification;
}
