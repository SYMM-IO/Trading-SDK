"use client";

import type {
  QuoteTpSlRow,
  RawTpSlNotificationState,
  TpSlInfoState,
  TpSlNotification,
  TpSlPriceType,
} from "@symmio/trading-core";
import { create } from "zustand";
import { toQuoteTpSl } from "./to-quote-tpsl";

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

  /** Fold the raw handler rows into snapshot fields and commit under `id`. */
  setRows(id: bigint, rows: QuoteTpSlRow[]): void;

  /**
   * Mark a side as "POST accepted, awaiting handler acknowledgement". Sets
   * `tpState` / `slState` to `"confirming"` directly. Optional `patch`
   * seeds the trigger price / priceType / cohQuoteId so the UI can show
   * the target value during the confirming window; a later
   * {@link applyNotification} transitions the state to the wire report.
   */
  markConfirming(
    id: bigint,
    side: "tp" | "sl",
    patch?: { price?: string; priceType?: TpSlPriceType; cohQuoteId?: string },
  ): void;

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
      upsert(id, (prev) => ({ ...prev, ...folded }));
      if (rowQuoteId !== undefined) {
        const rowId = BigInt(rowQuoteId);
        if (rowId !== id) get().link(id, rowId);
      }
    },

    markConfirming(id, side, patch) {
      upsert(id, (prev) => {
        const next: TpSlRecord = { ...prev };
        if (side === "tp") {
          next.tpState = "confirming";
          if (patch?.price !== undefined) next.tp = patch.price;
          if (patch?.priceType !== undefined) next.tpPriceType = patch.priceType;
          if (patch?.cohQuoteId !== undefined) next.tpCohQuoteId = patch.cohQuoteId;
        } else {
          next.slState = "confirming";
          if (patch?.price !== undefined) next.sl = patch.price;
          if (patch?.priceType !== undefined) next.slPriceType = patch.priceType;
          if (patch?.cohQuoteId !== undefined) next.slCohQuoteId = patch.cohQuoteId;
        }
        return next;
      });
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
              }
            : {}),
          ...(recordA.slState === "canceled" && recordB.slState !== "canceled"
            ? {
                sl: recordB.sl,
                slOpenPrice: recordB.slOpenPrice,
                slPriceType: recordB.slPriceType,
                slState: recordB.slState,
                slCohQuoteId: recordB.slCohQuoteId,
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

/** Reset the store — intended for tests only. */
export function __resetTpSlStore(): void {
  useTpSlStore.setState({ records: new Map(), index: new Map() });
}
