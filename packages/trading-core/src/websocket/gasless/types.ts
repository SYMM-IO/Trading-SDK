import type { GaslessRequest, GaslessRequestTransaction } from "../../gasless/types";
import type { GaslessCloseReason } from "./close-code-policy";

/**
 * Health of a gasless status stream, as reported to watchers.
 *
 * `live` is the only state where HTTP polling can stand down: a selector is
 * subscribed and the gateway has sent its snapshot. Every other state means the
 * caller should keep (or resume) polling.
 */
export type GaslessStreamStatus =
  /** No socket yet — nothing subscribed, or the first dial has not started. */
  | "idle"
  /** Dialing, or waiting for the `ready` handshake and this selector's snapshot. */
  | "connecting"
  /** Subscribed and delivering; poll fallback can pause. */
  | "live"
  /** Temporarily not delivering (reconnecting, throttled, or over the subscription cap); poll meanwhile. */
  | "degraded"
  /** Permanently off for this config — streams disabled, unauthorized, misrouted, or a client bug. */
  | "disabled";

/**
 * Why a stream is in its current state, when that is not obvious from the
 * status alone.
 */
export interface GaslessStreamStatusDetail {
  /** The cause, from the close-code policy or the gateway's own command error. */
  reason: GaslessCloseReason | "not-configured" | "not-found" | "subscription-limit" | "instance-mismatch" | "terminal";
  /** WebSocket close code, when a close produced this state. */
  closeCode?: number;
  /** One sentence naming what would change it. */
  detail: string;
}

/**
 * One delivery from a subscribed status stream.
 *
 * `snapshot` is the full current state, sent right after a subscribe (including
 * after a reconnect); `update` follows every stored change. Both carry complete
 * data, never a patch, so a consumer replaces its state from each one.
 */
export interface GaslessRequestStreamUpdate {
  /** Whether this frame is the subscribe snapshot or a later change. */
  kind: "snapshot" | "update";
  /** The workflow record, or `null` when the gateway sent one the SDK could not normalize. */
  request: GaslessRequest | null;
  /** Every stored transaction attempt for the workflow, in the gateway's order. */
  transactions: readonly GaslessRequestTransaction[];
}
