import type { QuoteTpSlRow, SearchTpSlOrdersReturnType, TpSlConditionalOrderType } from "@symmio/trading-core";
import { useTpSlStore, type TpSlSideKey } from "./tpsl-store";

/** One side of one quote a run is still waiting on. */
export interface TpSlWaitingSide {
  /** The quote's addressable id — on-chain, or the hedger temp id. */
  quoteId: bigint;
  /** Which side. */
  side: TpSlConditionalOrderType;
  /** What the wait is for: an order appearing, or an order disappearing. */
  intent: "write" | "cancel";
  /** For a cancel, the handler id that must be gone. */
  cohQuoteId?: string;
}

/** `tp` / `sl` for a conditional-order type. */
function sideKeyOf(side: TpSlConditionalOrderType): TpSlSideKey {
  return side === "take_profit" ? "tp" : "sl";
}

/**
 * Fold an account-scoped search response into the shared TP/SL store, on
 * behalf of the sides a run is still waiting on.
 *
 * Three rules keep an account-wide page from doing damage:
 *
 * 1. **Rows are attributed per quote.** `toQuoteTpSl` ignores `quote_id` and
 *    folds whatever array it is handed into one pair, so the rows are grouped
 *    first — otherwise one leg's stop-loss would land on another leg.
 * 2. **Only the waiting sides are written.** A page that lags on a side nobody
 *    asked about must not blank the live order sitting there.
 * 3. **Absence is only meaningful on a complete page.** A truncated response
 *    proves nothing about what is missing, so it contributes positive rows only
 *    and cancels wait for a clean tick.
 *
 * @param waiting - The sides still confirming, from the run's live step list.
 * @param snapshot - One account's search result.
 * @returns The quote ids that were written.
 */
export function applyTpSlSearchSnapshot(
  waiting: readonly TpSlWaitingSide[],
  snapshot: SearchTpSlOrdersReturnType,
): bigint[] {
  if (waiting.length === 0) return [];
  const store = useTpSlStore.getState();
  const byQuoteId = groupRowsByQuoteId(snapshot.orders);
  const written: bigint[] = [];

  for (const [quoteId, sides] of groupWaitingByQuote(waiting)) {
    const rows = rowsForQuote(byQuoteId, quoteId, sides);
    const applicable = sides.filter((entry) => isSideApplicable(entry, rows, snapshot.isComplete));
    if (applicable.length === 0) continue;
    store.setRowsForSides(
      quoteId,
      rows,
      applicable.map((entry) => sideKeyOf(entry.side)),
    );
    written.push(quoteId);
  }
  return written;
}

/**
 * Whether this tick may speak for a side.
 *
 * A write is applied whenever its row is present — that is the evidence the
 * store's own guard then checks.
 *
 * A cancel is applied only from a complete page on which **this side's** order
 * is gone. The handler id alone cannot decide it: this deployment issues one
 * `coh_quote_id` per quote, so cancelling a take-profit while the stop-loss
 * stays live leaves that id on the surviving row — matching on the id alone
 * would keep the cancel unconfirmed until it timed out, having actually
 * succeeded. Pairing the id with the side keeps the check honest whichever way
 * the handler assigns ids.
 */
function isSideApplicable(entry: TpSlWaitingSide, rows: readonly QuoteTpSlRow[], isComplete: boolean): boolean {
  const present = rows.some((row) => row.conditional_order_type === entry.side);
  if (entry.intent === "write") return present;
  if (!isComplete) return false;
  if (entry.cohQuoteId !== undefined) {
    return !rows.some((row) => row.conditional_order_type === entry.side && row.coh_quote_id === entry.cohQuoteId);
  }
  return !present;
}

/**
 * The rows belonging to one quote.
 *
 * Matched by `quote_id` first, then — for a quote the handler still keys under
 * an id this client has not linked yet — by the handler id a waiting cancel is
 * targeting. Both lookups must resolve to something real; comparing two unknown
 * ids would attribute a foreign row to this leg.
 */
function rowsForQuote(
  byQuoteId: Map<bigint, QuoteTpSlRow[]>,
  quoteId: bigint,
  sides: readonly TpSlWaitingSide[],
): QuoteTpSlRow[] {
  const direct = byQuoteId.get(quoteId);
  if (direct) return direct;
  const store = useTpSlStore.getState();
  const target = store.get(quoteId);
  for (const [rowQuoteId, rows] of byQuoteId) {
    const linked = store.get(rowQuoteId);
    if (target !== undefined && linked !== undefined && linked === target) return rows;
    const expected = sides.map((entry) => entry.cohQuoteId).filter(Boolean);
    if (expected.length > 0 && rows.some((row) => expected.includes(row.coh_quote_id))) return rows;
  }
  return [];
}

/** Group a page's rows by their on-chain quote id. */
function groupRowsByQuoteId(rows: readonly QuoteTpSlRow[]): Map<bigint, QuoteTpSlRow[]> {
  const grouped = new Map<bigint, QuoteTpSlRow[]>();
  for (const row of rows) {
    if (row.quote_id === undefined || row.quote_id === null) continue;
    const id = BigInt(row.quote_id);
    const bucket = grouped.get(id);
    if (bucket) bucket.push(row);
    else grouped.set(id, [row]);
  }
  return grouped;
}

/** Group the waiting sides by the quote they belong to. */
function groupWaitingByQuote(waiting: readonly TpSlWaitingSide[]): Map<bigint, TpSlWaitingSide[]> {
  const grouped = new Map<bigint, TpSlWaitingSide[]>();
  for (const entry of waiting) {
    const bucket = grouped.get(entry.quoteId);
    if (bucket) bucket.push(entry);
    else grouped.set(entry.quoteId, [entry]);
  }
  return grouped;
}
