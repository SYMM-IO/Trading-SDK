import type { QuoteTpSlRow, SearchTpSlOrdersReturnType } from "@symmio/trading-core";
import { afterEach, describe, expect, it } from "vitest";
import { applyTpSlSearchSnapshot, type TpSlWaitingSide } from "./apply-tpsl-search-snapshot";
import { __resetTpSlStore, useTpSlStore } from "./tpsl-store";

function row(overrides: Record<string, unknown> = {}): QuoteTpSlRow {
  return {
    quote_id: 1,
    coh_quote_id: "coh-1",
    party_a_address: "0xva",
    symbol_id: 1,
    conditional_order_type: "take_profit",
    quantity: 10,
    price: 1,
    conditional_order_price: 150,
    order_type: 1,
    state: "new",
    action_price_type: "markPrice",
    close_status: null,
    position_type: 0,
    leverage: null,
    create_time: 1,
    modify_time: 1,
    ...overrides,
  } as unknown as QuoteTpSlRow;
}

function snapshot(orders: QuoteTpSlRow[], isComplete = true): SearchTpSlOrdersReturnType {
  return { orders, count: orders.length, isComplete };
}

function waitingWrite(quoteId: bigint, side: TpSlWaitingSide["side"] = "take_profit"): TpSlWaitingSide {
  return { quoteId, side, intent: "write" };
}

function waitingCancel(quoteId: bigint, cohQuoteId: string, side: TpSlWaitingSide["side"] = "take_profit") {
  return { quoteId, side, intent: "cancel", cohQuoteId } satisfies TpSlWaitingSide;
}

describe("applyTpSlSearchSnapshot", () => {
  afterEach(() => __resetTpSlStore());

  it("attributes each row to its own quote instead of folding the whole page onto one", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(1n, "tp", { price: "150" });
    store.markConfirming(2n, "tp", { price: "250" });

    applyTpSlSearchSnapshot(
      [waitingWrite(1n), waitingWrite(2n)],
      snapshot([
        row({ quote_id: 1, conditional_order_price: 150, coh_quote_id: "coh-1" }),
        row({ quote_id: 2, conditional_order_price: 250, coh_quote_id: "coh-2" }),
      ]),
    );

    expect(store.get(1n)?.tp).toBe("150");
    expect(store.get(2n)?.tp).toBe("250");
    expect(store.get(1n)?.tpState).toBe("new");
    expect(store.get(2n)?.tpState).toBe("new");
  });

  it("leaves a live order on a side nobody is waiting for untouched", () => {
    const store = useTpSlStore.getState();
    // Leg 1 has a live TP and a stop-loss edit in flight.
    store.setRows(1n, [row({ quote_id: 1, conditional_order_price: 150 })]);
    store.markConfirming(1n, "sl", { price: "90" });

    // The page carries the SL but has not caught up with the TP.
    applyTpSlSearchSnapshot(
      [{ quoteId: 1n, side: "stop_loss", intent: "write" }],
      snapshot([row({ quote_id: 1, conditional_order_type: "stop_loss", conditional_order_price: 90 })]),
    );

    expect(store.get(1n)?.tp).toBe("150");
    expect(store.get(1n)?.tpState).toBe("new");
    expect(store.get(1n)?.sl).toBe("90");
  });

  it("confirms a cancel when its handler id is gone from a complete page", () => {
    const store = useTpSlStore.getState();
    store.setRows(1n, [row({ quote_id: 1, coh_quote_id: "coh-doomed" })]);
    store.markConfirming(1n, "tp", { intent: "cancel" });

    applyTpSlSearchSnapshot([waitingCancel(1n, "coh-doomed")], snapshot([]));

    expect(store.get(1n)?.tpState).toBe("canceled");
  });

  it("confirms a cancel even while the other side stays live under the same handler id", () => {
    const store = useTpSlStore.getState();
    // One coh id covers the whole quote here, so the surviving stop-loss row
    // still carries the id the cancelled take-profit was targeting. Matching on
    // the id alone would leave this cancel unconfirmed until it timed out.
    store.setRows(42n, [
      row({ quote_id: 42, coh_quote_id: "coh1227" }),
      row({ quote_id: 42, conditional_order_type: "stop_loss", coh_quote_id: "coh1227" }),
    ]);
    store.markConfirming(42n, "tp", { intent: "cancel" });

    applyTpSlSearchSnapshot(
      [{ quoteId: 42n, side: "take_profit", intent: "cancel", cohQuoteId: "coh1227" }],
      snapshot([row({ quote_id: 42, conditional_order_type: "stop_loss", coh_quote_id: "coh1227" })]),
    );

    expect(store.get(42n)?.tpState).toBe("canceled");
    expect(store.get(42n)?.slState).toBe("new");
  });

  it("does not confirm a cancel from an incomplete page", () => {
    const store = useTpSlStore.getState();
    store.setRows(1n, [row({ quote_id: 1, coh_quote_id: "coh-doomed" })]);
    store.markConfirming(1n, "tp", { intent: "cancel" });

    // A truncated page proves nothing about what is missing from it.
    applyTpSlSearchSnapshot([waitingCancel(1n, "coh-doomed")], snapshot([], false));

    expect(store.get(1n)?.tpState).toBe("confirming");
  });

  it("does not confirm a cancel while its own order is still listed", () => {
    const store = useTpSlStore.getState();
    store.setRows(1n, [row({ quote_id: 1, coh_quote_id: "coh-doomed" })]);
    store.markConfirming(1n, "tp", { intent: "cancel" });

    applyTpSlSearchSnapshot(
      [waitingCancel(1n, "coh-doomed")],
      snapshot([row({ quote_id: 1, coh_quote_id: "coh-doomed" })]),
    );

    expect(store.get(1n)?.tpState).toBe("confirming");
  });

  it("settles a write only on evidence of the submitted order", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(1n, "tp", { price: "160", cohQuoteId: "coh-new" });

    // A stale row for the order being replaced.
    applyTpSlSearchSnapshot(
      [waitingWrite(1n)],
      snapshot([row({ quote_id: 1, conditional_order_price: 150, coh_quote_id: "coh-old" })]),
    );
    expect(store.get(1n)?.tpState).toBe("confirming");

    applyTpSlSearchSnapshot(
      [waitingWrite(1n)],
      snapshot([row({ quote_id: 1, conditional_order_price: 160, coh_quote_id: "coh-new" })]),
    );
    expect(store.get(1n)?.tpState).toBe("new");
  });

  it("ignores a page that carries no rows for a waiting write", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(1n, "tp", { price: "150" });

    applyTpSlSearchSnapshot([waitingWrite(1n)], snapshot([row({ quote_id: 99 })]));

    expect(store.get(1n)?.tpState).toBe("confirming");
    // A foreign row must never land on this leg.
    expect(store.get(1n)?.tp).toBe("150");
  });

  it("writes nothing when the waiting set is empty", () => {
    const store = useTpSlStore.getState();
    applyTpSlSearchSnapshot([], snapshot([row({ quote_id: 1 })]));
    expect(store.get(1n)).toBeUndefined();
  });
});
