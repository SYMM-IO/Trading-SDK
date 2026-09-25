import type { QuoteTpSl, TpSlInfoState } from "@symmio/trading-core";
import { glyph, theme } from "../../config/theme.js";
import { formatPrice } from "../../lib/format.js";

/** One TP/SL side, resolved to the string and color the terminal renders. */
export interface TpSlSideView {
  /** `true` when the handler holds a live order for this side. */
  active: boolean;
  /** Trigger price, or an em dash when there is no order. */
  value: string;
  /** State worth surfacing next to the price; `new` is steady and gets none. */
  note?: string;
  color: string;
}

/**
 * States that are not yet (or no longer) a plain resting trigger. `new` is the
 * steady state — a resting order needs no annotation.
 */
const NOTES: Partial<Record<TpSlInfoState, { note: string; color: string }>> = {
  loading: { note: "loading", color: theme.faint },
  pending: { note: "pending", color: theme.warning },
  confirming: { note: "confirming", color: theme.warning },
  triggered: { note: "triggered", color: theme.info },
};

/** Resolve one side of a folded snapshot for display. TP is mint, SL is rose. */
export function tpSlSideView(side: "tp" | "sl", snapshot?: QuoteTpSl, pricePrecision?: number): TpSlSideView {
  const price = side === "tp" ? snapshot?.tp : snapshot?.sl;
  const state = side === "tp" ? snapshot?.tpState : snapshot?.slState;
  if (!price || !state) return { active: false, value: "—", color: theme.faint };
  const annotation = NOTES[state];
  return {
    active: true,
    value: formatPrice(price, pricePrecision),
    note: annotation?.note,
    color: annotation?.color ?? (side === "tp" ? theme.positive : theme.negative),
  };
}

/** A side rendered as `65,000 · pending` — the price plus its state, if any. */
export function tpSlSideLabel(view: TpSlSideView): string {
  return view.note != null ? `${view.value} ${glyph.dot} ${view.note}` : view.value;
}
