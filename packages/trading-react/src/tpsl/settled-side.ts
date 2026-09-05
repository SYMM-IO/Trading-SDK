import type { TpSlConditionalOrderType } from "@symmio/trading-core";
import type { TpSlRecord } from "./tpsl-store";

/** A side's confirmed lifecycle state and trigger value, off a folded record. */
function sideOf(record: TpSlRecord, side: TpSlConditionalOrderType): { state: string; value: string } {
  return side === "take_profit"
    ? { state: record.tpState, value: record.tp }
    : { state: record.slState, value: record.sl };
}

/**
 * Whether the handler has acknowledged a **write** on this side — the shared
 * store moved it out of the optimistic `confirming` / `pending` window into a
 * live state.
 *
 * The store is fed by every TP/SL signal (any WebSocket subscription's
 * `applyNotification`, and the success refetch's `setRows`), so a run step that
 * reads it resolves no matter which signal delivered the update — even when the
 * run hook's own subscription never received the frame.
 *
 * `"pending"` counts: the handler holds the order, which is what the write was
 * waiting to learn, and it is one of the states the fallback sweep explicitly
 * asks for. `"killed"` does not appear here because no signal can produce it —
 * `toQuoteTpSl` maps a killed row to "no active order" and the frame parser has
 * no such state.
 */
export function isWriteSideSettled(record: TpSlRecord, side: TpSlConditionalOrderType): boolean {
  const { state } = sideOf(record, side);
  return state === "new" || state === "pending" || state === "triggered";
}

/**
 * Whether the handler has confirmed a **cancel** on this side — the store shows
 * it gone.
 *
 * Keyed on `state === "canceled"` only, never on an empty trigger value: a
 * blank/unseeded record also has an empty value, and that must not read as a
 * confirmed cancel. Both real signals resolve here — the WebSocket `cancel`
 * frame maps to `"canceled"`, and a post-cancel refetch that returns no rows
 * folds (via `toQuoteTpSl`) to `"canceled"` too.
 */
export function isCancelSideSettled(record: TpSlRecord, side: TpSlConditionalOrderType): boolean {
  return sideOf(record, side).state === "canceled";
}
