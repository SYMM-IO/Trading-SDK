import type { QuoteTpSl, QuoteTpSlRow, QuoteTpSlRowState, TpSlInfoState, TpSlPriceType } from "@symm-frontier/core";

/**
 * Fold the handler's per-conditional-order rows into a single {@link QuoteTpSl}.
 *
 * For each side (TP / SL) we keep the most recent row (highest `modify_time`)
 * that is still actionable (`pending`, `new`, `triggered`, `triggered_pending`).
 * Terminated rows (`canceled`, `killed`) are skipped. A side with no active row
 * ends up with empty values and a `canceled` sentinel state — the UI should
 * render an empty side as "no active order" rather than a badge.
 *
 * Field mapping (live API field → SDK field):
 * - `conditional_order_price` → `tp` / `sl` (trigger price, stringified)
 * - `price`                   → `tpOpenPrice` / `slOpenPrice` (stringified)
 * - `action_price_type`       → `tpPriceType` / `slPriceType`
 * - `coh_quote_id`            → `tpCohQuoteId` / `slCohQuoteId`
 * - `state`                   → `tpState` / `slState`
 */
export function toQuoteTpSl(rows: QuoteTpSlRow[] | null | undefined): QuoteTpSl {
  let tp = "";
  let sl = "";
  let tpOpenPrice = "";
  let slOpenPrice = "";
  let tpPriceType: TpSlPriceType = "markPrice";
  let slPriceType: TpSlPriceType = "markPrice";
  let tpState: TpSlInfoState = "canceled";
  let slState: TpSlInfoState = "canceled";
  let tpCohQuoteId: string | undefined;
  let slCohQuoteId: string | undefined;
  let tpModifyTime = -Infinity;
  let slModifyTime = -Infinity;

  for (const row of rows ?? []) {
    const mapped = mapRowState(row.state);
    if (!mapped) continue;
    const priceType: TpSlPriceType = row.action_price_type === "last_close" ? "lastPrice" : "markPrice";
    const triggerPrice = numberToString(row.conditional_order_price);
    const openPrice = row.price != null ? numberToString(row.price) : "";
    if (row.conditional_order_type === "take_profit") {
      if (row.modify_time <= tpModifyTime) continue;
      tpModifyTime = row.modify_time;
      tp = triggerPrice;
      tpOpenPrice = openPrice;
      tpPriceType = priceType;
      tpCohQuoteId = row.coh_quote_id;
      tpState = mapped;
    } else if (row.conditional_order_type === "stop_loss") {
      if (row.modify_time <= slModifyTime) continue;
      slModifyTime = row.modify_time;
      sl = triggerPrice;
      slOpenPrice = openPrice;
      slPriceType = priceType;
      slCohQuoteId = row.coh_quote_id;
      slState = mapped;
    }
  }

  return {
    tp,
    sl,
    tpOpenPrice,
    slOpenPrice,
    tpPriceType,
    slPriceType,
    tpState,
    slState,
    tpCohQuoteId,
    slCohQuoteId,
  };
}

/**
 * Map the handler's row state onto the SDK's {@link TpSlInfoState}. Returns
 * `null` for terminated states so the fold skips them.
 */
function mapRowState(state: QuoteTpSlRowState): TpSlInfoState | null {
  switch (state) {
    case "new":
      return "new";
    case "pending":
      return "pending";
    case "triggered":
    case "triggered_pending":
      return "triggered";
    case "canceled":
    case "killed":
      return null;
    default:
      return null;
  }
}

/**
 * Stringify a numeric trigger / open price without injecting `1e-7` for tiny
 * values. `Number#toString()` already does this for the magnitudes we expect,
 * but routing through a helper makes the intent explicit and gives us one
 * place to swap in a Decimal-aware formatter later.
 */
function numberToString(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(value);
}
