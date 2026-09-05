"use client";

import type {
  QuoteTpSl,
  QuoteTpSlRow,
  RawTpSlNotificationState,
  TpSlInfoState,
  TpSlNotification,
  TpSlPriceType,
} from "@symmio/trading-core";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { toQuoteTpSl } from "./to-quote-tpsl";

/**
 * How long a `"confirming"` write survives a REST snapshot that does not list
 * it yet, in milliseconds.
 *
 * A refetch issued right after a POST routinely lands before the handler has
 * registered the order. Without this window the empty snapshot would fold to
 * `"canceled"` and erase the price the trader just set, so the side holds its
 * `"confirming"` state until a report arrives, the rows list it, or the window
 * closes.
 *
 * Deliberately longer than `DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS`: a grouped
 * run must reach its own deadline and release the guard itself, rather than
 * having the guard expire underneath it. This is the backstop for every other
 * caller, which has no deadline of its own.
 */
export const TPSL_CONFIRMING_GUARD_MS = 90_000;

/** What a side is waiting for while it is `"confirming"`, and since when. */
export interface TpSlConfirmation {
  /** `"write"` — an order was submitted. `"cancel"` — a live order was cancelled. */
  intent: "write" | "cancel";
  /** Epoch milliseconds the side entered `"confirming"`. */
  at: number;
  /** Trigger price the write submitted — the evidence a snapshot must show. */
  price?: string;
  /**
   * Market price precision the write was signed at.
   *
   * The handler is sent — and stores — the trigger price rounded to this many
   * decimals, so a seed carrying more of them describes the same order. Without
   * it, a trader who types `0.00693` into a 4-decimal market would never see
   * their write confirmed: the rows come back `0.0069` and no comparison of the
   * two raw strings can tell "rounded" from "different".
   */
  pricePrecision?: number;
  /** Price type the write submitted. */
  priceType?: TpSlPriceType;
  /** Handler-issued id the write was told to expect, when the POST returned one. */
  cohQuoteId?: string;
}

/** One side of a quote's TP/SL record. */
export type TpSlSideKey = "tp" | "sl";

/** Both sides — the default scope of a snapshot fold. */
const BOTH_SIDES: readonly TpSlSideKey[] = ["tp", "sl"];

/**
 * Relative tolerance when matching a snapshot's trigger price against the one
 * a write submitted. Absorbs `"1.50"` vs `1.5` and JSON double round-tripping,
 * without accepting a genuinely different price.
 */
const PRICE_MATCH_TOLERANCE = 1e-9;

/**
 * One quote's folded TP/SL state. The same record instance is referenced from
 * every id that resolves to it via {@link TpSlStoreState.index} — the caller
 * can pass either the on-chain `quoteId` or the hedger `tempQuoteId` and get
 * the same record back.
 *
 * `tpState` / `slState` is the single source of truth for how a side is
 * rendered — including the transient `"confirming"` phase between a POST
 * accepting and the WS report landing. No separate overlay field.
 */
export interface TpSlRecord {
  /** On-chain quote id — set once the quote anchors. */
  quoteId?: bigint;
  /** Hedger `tempQuoteId` — set during the pre-chain window. */
  tempQuoteId?: bigint;

  tp: string;
  sl: string;
  tpOpenPrice: string;
  slOpenPrice: string;
  tpPriceType: TpSlPriceType;
  slPriceType: TpSlPriceType;
  tpState: TpSlInfoState;
  slState: TpSlInfoState;
  tpCohQuoteId?: string;
  slCohQuoteId?: string;
  /** Set while `tpState` is `"confirming"`; cleared as soon as the side resolves. */
  tpConfirm?: TpSlConfirmation;
  /** Set while `slState` is `"confirming"`; cleared as soon as the side resolves. */
  slConfirm?: TpSlConfirmation;
}

/** Internal identity of a record — opaque string, never leaks to consumers. */
type TpSlRecordKey = string;

/**
 * Zustand store shape. `records` holds one entry per quote; `index` maps every
 * id we've ever seen for that quote — on-chain and temp — to the same
 * `records` key.
 */
export interface TpSlStoreState {
  records: Map<TpSlRecordKey, TpSlRecord>;
  index: Map<bigint, TpSlRecordKey>;

  /** Read a record via any id. Returns `undefined` when the id is unknown. */
  get(id: bigint): TpSlRecord | undefined;

  /**
   * Fold the raw handler rows for **one quote** into snapshot fields and commit
   * under `id`, then alias the rows' `quote_id` onto the same record.
   *
   * A side left `"confirming"` by a `"write"` is held rather than cleared until
   * the rows show the submitted order — see {@link TPSL_CONFIRMING_GUARD_MS}.
   * A `"cancel"` is confirmed by absence, so an authoritative snapshot still
   * resolves both intents.
   *
   * Pass only one quote's rows. An account-wide page would alias a foreign
   * `quote_id` onto this record and merge two legs into one — use
   * {@link setRowsForSides} for those.
   */
  setRows(id: bigint, rows: QuoteTpSlRow[]): void;

  /**
   * {@link setRows} restricted to `sides`, and without the `quote_id` aliasing.
   *
   * The entry point for a snapshot whose authority is partial — an
   * account-scoped search that this caller only trusts for the sides it is
   * waiting on. Sides outside `sides` are left exactly as they were, so a page
   * that lags on an unrelated side cannot blank a live order.
   */
  setRowsForSides(id: bigint, rows: QuoteTpSlRow[], sides: readonly TpSlSideKey[]): void;

  /**
   * Mark a side as "POST accepted, awaiting handler acknowledgement". Sets
   * `tpState` / `slState` to `"confirming"` directly. Optional `patch`
   * seeds the trigger price / priceType / cohQuoteId so the UI can show
   * the target value during the confirming window; a later
   * {@link applyNotification} transitions the state to the wire report.
   *
   * `patch.intent` says what the side is waiting for — default `"write"`.
   * Cancels must pass `"cancel"`, otherwise the write guard in
   * {@link setRows} would keep holding a side the handler has already removed.
   *
   * A write's `price` / `priceType` / `cohQuoteId` are also kept as the
   * evidence a later snapshot must show before the side counts as confirmed,
   * so a stale row cannot settle an edit that never landed.
   */
  markConfirming(
    id: bigint,
    side: TpSlSideKey,
    patch?: {
      price?: string;
      pricePrecision?: number;
      priceType?: TpSlPriceType;
      cohQuoteId?: string;
      intent?: TpSlConfirmation["intent"];
    },
  ): void;

  /**
   * Drop a side's confirmation guard without touching its rendered state, so
   * the next {@link setRows} writes the handler's rows through unheld.
   *
   * Called when a run gives up waiting for the report: the REST snapshot — even
   * an empty one — becomes the truth again.
   */
  clearConfirming(id: bigint, side: TpSlSideKey): void;

  /**
   * Apply a WS notification to the record's side state (and optionally its
   * trigger price when `details.trigger_price` is present). Maps the raw
   * notification state onto {@link TpSlInfoState}. Failure frames
   * (`successful: false`) are ignored — the confirming state remains until
   * the next successful frame or REST fetch resolves it.
   */
  applyNotification(id: bigint, notification: TpSlNotification): void;

  /**
   * Declare that two ids refer to the same TP/SL record — typically called
   * when the quote reconciliation layer learns a `tempQuoteId ↔ quoteId`
   * pairing from a solver notification.
   */
  link(a: bigint, b: bigint): void;
}

function blank(): TpSlRecord {
  return {
    tp: "",
    sl: "",
    tpOpenPrice: "",
    slOpenPrice: "",
    tpPriceType: "markPrice",
    slPriceType: "markPrice",
    tpState: "canceled",
    slState: "canceled",
  };
}

/**
 * Fold a REST snapshot onto a record, over `sides` only, without erasing or
 * falsely settling a write the handler has not published yet.
 *
 * `sides` exists because a snapshot is not always about the whole record: an
 * account-scoped page may legitimately lag on one side, and folding that side
 * anyway would blank a live order the caller never asked about. A per-quote
 * read passes both sides and behaves exactly as before.
 */
function foldSnapshot(prev: TpSlRecord, folded: QuoteTpSl, sides: readonly TpSlSideKey[]): TpSlRecord {
  const next: TpSlRecord = { ...prev };
  if (sides.includes("tp")) {
    if (holdsConfirming(prev.tpConfirm, folded.tpState, folded.tp, folded.tpCohQuoteId)) {
      next.tpState = "confirming";
    } else {
      next.tp = folded.tp;
      next.tpOpenPrice = folded.tpOpenPrice;
      next.tpPriceType = folded.tpPriceType;
      next.tpCohQuoteId = folded.tpCohQuoteId;
      next.tpState = folded.tpState;
      next.tpConfirm = undefined;
    }
  }
  if (sides.includes("sl")) {
    if (holdsConfirming(prev.slConfirm, folded.slState, folded.sl, folded.slCohQuoteId)) {
      next.slState = "confirming";
    } else {
      next.sl = folded.sl;
      next.slOpenPrice = folded.slOpenPrice;
      next.slPriceType = folded.slPriceType;
      next.slCohQuoteId = folded.slCohQuoteId;
      next.slState = folded.slState;
      next.slConfirm = undefined;
    }
  }
  return next;
}

/**
 * Whether a snapshot must leave a `"confirming"` side alone.
 *
 * A write is settled only by **evidence of the order it submitted**, and the
 * trigger price is that evidence. Absence is not evidence, and neither is a
 * *stale* row: a snapshot still showing the pre-edit price would otherwise
 * report an edit as confirmed and render the old price as though it were live.
 *
 * Two things are deliberately **not** part of the test:
 *
 * - **The handler id, whenever a price is known.** It is not reliably per-order:
 *   this deployment issues one `coh_quote_id` per *quote*, shared by both sides
 *   and by every superseded order in that quote's history — so a matching id
 *   would happily settle a write against the row it was replacing. It is kept
 *   only as a fallback for a confirmation that seeded no price at all.
 * - **The price type.** The handler stores its own (`market` / `last_close`
 *   values both appear on a single quote), so requiring it to echo what was
 *   submitted would strand a perfectly good write in `"confirming"` until the
 *   deadline. A type-only edit therefore settles on the first live row; the
 *   report corrects the rendered type a moment later.
 *
 * A cancel is never held: absence is exactly what it is waiting for.
 */
function holdsConfirming(
  confirmation: TpSlConfirmation | undefined,
  foldedState: TpSlInfoState,
  foldedPrice: string,
  foldedCohQuoteId: string | undefined,
): boolean {
  if (confirmation?.intent !== "write") return false;
  if (Date.now() - confirmation.at >= TPSL_CONFIRMING_GUARD_MS) return false;
  if (foldedState === "canceled") return true;
  if (confirmation.price !== undefined) {
    return !pricesMatch(confirmation.price, foldedPrice, confirmation.pricePrecision);
  }
  if (confirmation.cohQuoteId !== undefined && foldedCohQuoteId !== undefined) {
    return foldedCohQuoteId !== confirmation.cohQuoteId;
  }
  return false;
}

/**
 * Field-wise equality of two records. Confirmations compare by reference —
 * `foldSnapshot` either carries the previous instance through or drops it, so a
 * new instance always means a real change.
 */
function isSameRecord(a: TpSlRecord, b: TpSlRecord): boolean {
  return (
    a.quoteId === b.quoteId &&
    a.tempQuoteId === b.tempQuoteId &&
    a.tp === b.tp &&
    a.sl === b.sl &&
    a.tpOpenPrice === b.tpOpenPrice &&
    a.slOpenPrice === b.slOpenPrice &&
    a.tpPriceType === b.tpPriceType &&
    a.slPriceType === b.slPriceType &&
    a.tpState === b.tpState &&
    a.slState === b.slState &&
    a.tpCohQuoteId === b.tpCohQuoteId &&
    a.slCohQuoteId === b.slCohQuoteId &&
    a.tpConfirm === b.tpConfirm &&
    a.slConfirm === b.slConfirm
  );
}

/**
 * Numeric trigger-price equality within {@link PRICE_MATCH_TOLERANCE}.
 *
 * When the write recorded the precision it was signed at, both sides are
 * rounded to it first — the handler stores the rounded value, so `0.00693` and
 * a returned `0.0069` are the same order in a 4-decimal market. Rounding both
 * (rather than trusting the returned value's decimal count, which JSON strips
 * trailing zeros from) keeps a genuine edit distinguishable: at precision 2,
 * `2.14` against a stale `2.1` still rounds to `2.14` vs `2.10`.
 */
function pricesMatch(expected: string, actual: string, pricePrecision?: number): boolean {
  if (expected === actual) return true;
  let left = Number(expected);
  let right = Number(actual);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (pricePrecision !== undefined && Number.isInteger(pricePrecision) && pricePrecision >= 0) {
    left = Number(left.toFixed(pricePrecision));
    right = Number(right.toFixed(pricePrecision));
  }
  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) <= PRICE_MATCH_TOLERANCE * scale;
}

/** Map the WS notification state onto {@link TpSlInfoState}. */
function mapNotificationState(state: RawTpSlNotificationState): TpSlInfoState {
  switch (state) {
    case "new":
    case "edit":
      return "new";
    case "pending":
      return "pending";
    case "triggered":
    case "trigger":
      return "triggered";
    case "cancel":
    case "canceled":
    case "cancelled":
    case "close":
      return "canceled";
    default:
      return "new";
  }
}

/**
 * Module-level Zustand store for the folded TP/SL snapshot per quote. Single
 * instance across the app is intentional (see AGENTS.md — "TP/SL data live in
 * one place"); tests can call {@link __resetTpSlStore} between runs to reset.
 */
export const useTpSlStore = create<TpSlStoreState>((set, get) => {
  let keyCounter = 0;
  function newKey(): TpSlRecordKey {
    keyCounter += 1;
    return `r${keyCounter}`;
  }

  function upsert(id: bigint, mutator: (prev: TpSlRecord) => TpSlRecord): void {
    set((state) => {
      const records = new Map(state.records);
      const index = new Map(state.index);
      let key = index.get(id);
      let prev: TpSlRecord;
      if (key === undefined) {
        key = newKey();
        prev = blank();
        index.set(id, key);
      } else {
        prev = records.get(key) ?? blank();
      }
      const next = mutator(prev);
      if (id < 0n) {
        next.tempQuoteId ??= id;
      } else {
        next.quoteId ??= id;
      }
      /**
       * A fold that changed nothing returns the state object itself, so
       * zustand's `Object.is` check skips the notification entirely. Without
       * this a 2s fallback sweep would wake every waiter and re-render every
       * TP/SL cell on each tick that merely confirmed the status quo.
       */
      if (index.get(id) === key && isSameRecord(prev, next)) return state;
      records.set(key, next);
      return { records, index };
    });
  }

  return {
    records: new Map(),
    index: new Map(),

    get(id) {
      const state = get();
      const key = state.index.get(id);
      return key === undefined ? undefined : state.records.get(key);
    },

    setRows(id, rows) {
      const folded = toQuoteTpSl(rows);
      const rowQuoteId = rows.find((r) => r.quote_id && r.quote_id !== 0)?.quote_id;
      upsert(id, (prev) => foldSnapshot(prev, folded, BOTH_SIDES));
      if (rowQuoteId !== undefined) {
        const rowId = BigInt(rowQuoteId);
        if (rowId !== id) get().link(id, rowId);
      }
    },

    setRowsForSides(id, rows, sides) {
      if (sides.length === 0) return;
      const folded = toQuoteTpSl(rows);
      upsert(id, (prev) => foldSnapshot(prev, folded, sides));
    },

    markConfirming(id, side, patch) {
      const confirmation: TpSlConfirmation = {
        intent: patch?.intent ?? "write",
        at: Date.now(),
        price: patch?.price,
        pricePrecision: patch?.pricePrecision,
        priceType: patch?.priceType,
        cohQuoteId: patch?.cohQuoteId,
      };
      upsert(id, (prev) => {
        const next: TpSlRecord = { ...prev };
        if (side === "tp") {
          next.tpState = "confirming";
          next.tpConfirm = confirmation;
          if (patch?.price !== undefined) next.tp = patch.price;
          if (patch?.priceType !== undefined) next.tpPriceType = patch.priceType;
          if (patch?.cohQuoteId !== undefined) next.tpCohQuoteId = patch.cohQuoteId;
        } else {
          next.slState = "confirming";
          next.slConfirm = confirmation;
          if (patch?.price !== undefined) next.sl = patch.price;
          if (patch?.priceType !== undefined) next.slPriceType = patch.priceType;
          if (patch?.cohQuoteId !== undefined) next.slCohQuoteId = patch.cohQuoteId;
        }
        return next;
      });
    },

    clearConfirming(id, side) {
      const record = get().get(id);
      if (!record) return;
      if (side === "tp" ? record.tpConfirm === undefined : record.slConfirm === undefined) return;
      upsert(id, (prev) => (side === "tp" ? { ...prev, tpConfirm: undefined } : { ...prev, slConfirm: undefined }));
    },

    applyNotification(id, notification) {
      if (!notification.successful) return;
      const side =
        notification.conditionalOrderType === "take_profit"
          ? "tp"
          : notification.conditionalOrderType === "stop_loss"
            ? "sl"
            : null;
      if (!side) return;
      const nextState = mapNotificationState(notification.state);
      const trigger = notification.details?.trigger_price;
      upsert(id, (prev) => {
        const next: TpSlRecord = { ...prev };
        if (side === "tp") {
          next.tpState = nextState;
          next.tpConfirm = undefined;
          if (nextState === "canceled") {
            next.tp = "";
            next.tpOpenPrice = "";
            next.tpCohQuoteId = undefined;
          } else {
            if (trigger !== undefined) next.tp = String(trigger);
            if (notification.cohQuoteId) next.tpCohQuoteId = notification.cohQuoteId;
          }
        } else {
          next.slState = nextState;
          next.slConfirm = undefined;
          if (nextState === "canceled") {
            next.sl = "";
            next.slOpenPrice = "";
            next.slCohQuoteId = undefined;
          } else {
            if (trigger !== undefined) next.sl = String(trigger);
            if (notification.cohQuoteId) next.slCohQuoteId = notification.cohQuoteId;
          }
        }
        return next;
      });
    },

    link(a, b) {
      if (a === b) return;
      set((state) => {
        const records = new Map(state.records);
        const index = new Map(state.index);
        const keyA = index.get(a);
        const keyB = index.get(b);

        if (keyA === undefined && keyB === undefined) {
          const key = newKey();
          const record = blank();
          if (a < 0n) record.tempQuoteId = a;
          else record.quoteId = a;
          if (b < 0n) record.tempQuoteId ??= b;
          else record.quoteId ??= b;
          records.set(key, record);
          index.set(a, key);
          index.set(b, key);
          return { records, index };
        }

        if (keyA !== undefined && keyB === undefined) {
          index.set(b, keyA);
          const prev = records.get(keyA);
          if (prev) {
            const next: TpSlRecord = { ...prev };
            if (b < 0n) next.tempQuoteId ??= b;
            else next.quoteId ??= b;
            records.set(keyA, next);
          }
          return { records, index };
        }

        if (keyA === undefined && keyB !== undefined) {
          index.set(a, keyB);
          const prev = records.get(keyB);
          if (prev) {
            const next: TpSlRecord = { ...prev };
            if (a < 0n) next.tempQuoteId ??= a;
            else next.quoteId ??= a;
            records.set(keyB, next);
          }
          return { records, index };
        }

        if (keyA === keyB) return state;

        const recordA = records.get(keyA!) ?? blank();
        const recordB = records.get(keyB!) ?? blank();
        const merged: TpSlRecord = {
          ...recordA,
          quoteId: recordA.quoteId ?? recordB.quoteId,
          tempQuoteId: recordA.tempQuoteId ?? recordB.tempQuoteId,
          ...(recordA.tpState === "canceled" && recordB.tpState !== "canceled"
            ? {
                tp: recordB.tp,
                tpOpenPrice: recordB.tpOpenPrice,
                tpPriceType: recordB.tpPriceType,
                tpState: recordB.tpState,
                tpCohQuoteId: recordB.tpCohQuoteId,
                tpConfirm: recordB.tpConfirm,
              }
            : {}),
          ...(recordA.slState === "canceled" && recordB.slState !== "canceled"
            ? {
                sl: recordB.sl,
                slOpenPrice: recordB.slOpenPrice,
                slPriceType: recordB.slPriceType,
                slState: recordB.slState,
                slCohQuoteId: recordB.slCohQuoteId,
                slConfirm: recordB.slConfirm,
              }
            : {}),
        };
        records.set(keyA!, merged);
        records.delete(keyB!);
        for (const [id, k] of index) {
          if (k === keyB) index.set(id, keyA!);
        }
        return { records, index };
      });
    },
  };
});

/**
 * Selector hook: subscribe to the record addressed by `id`. Returns
 * `undefined` until a row set or mutation has landed for that id (or for
 * another id linked to the same record).
 */
export function useTpSlRecord(id: bigint | undefined): TpSlRecord | undefined {
  return useTpSlStore((state) => {
    if (id === undefined) return undefined;
    const key = state.index.get(id);
    return key === undefined ? undefined : state.records.get(key);
  });
}

/**
 * Selector hook: subscribe to the records addressed by `ids`, in input order.
 * The grouped counterpart of {@link useTpSlRecord} — one subscription for N
 * children, which a `.map` over children could not do legally anyway.
 *
 * Shallow-compared, so an unrelated record's update does not re-render the
 * group. Pass a stable `ids` array (memoize it) to avoid recomputing per render.
 *
 * @param ids - Quote ids, on-chain or temp. `undefined` entries yield `undefined`.
 * @returns One record (or `undefined`) per input id, in the same order.
 */
export function useTpSlRecords(ids: readonly (bigint | undefined)[]): Array<TpSlRecord | undefined> {
  return useTpSlStore(
    useShallow((state) =>
      ids.map((id) => {
        if (id === undefined) return undefined;
        const key = state.index.get(id);
        return key === undefined ? undefined : state.records.get(key);
      }),
    ),
  );
}

/** Reset the store — intended for tests only. */
export function __resetTpSlStore(): void {
  useTpSlStore.setState({ records: new Map(), index: new Map() });
}
