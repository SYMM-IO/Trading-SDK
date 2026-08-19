import type { QuoteTpSlRow, TpSlNotification } from "@symmio/trading-core";
import { afterEach, describe, expect, it } from "vitest";
import { __resetTpSlStore, useTpSlStore } from "./tpsl-store";

function row(overrides: Record<string, unknown>): QuoteTpSlRow {
  return {
    quote_id: 0,
    coh_quote_id: "coh1",
    party_a_address: "0xaaa",
    symbol_id: 1,
    conditional_order_type: "take_profit",
    quantity: 10,
    price: 1,
    conditional_order_price: 10,
    order_type: 1,
    state: "pending",
    action_price_type: "market",
    close_status: null,
    position_type: 0,
    leverage: null,
    create_time: 1,
    modify_time: 1,
    ...overrides,
  } as unknown as QuoteTpSlRow;
}

function notification(overrides: Record<string, unknown>): TpSlNotification {
  return {
    quoteId: 42,
    primaryIdentifier: 42,
    secondaryIdentifier: 0,
    account: "0xaaa",
    conditionalOrderType: "take_profit",
    state: "new",
    successful: true,
    cohQuoteId: "coh42",
    raw: {},
    ...overrides,
  } as unknown as TpSlNotification;
}

describe("useTpSlStore", () => {
  afterEach(() => {
    __resetTpSlStore();
  });

  it("`markConfirming` sets the side's state to `confirming`", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(-1001n, "tp");
    expect(store.get(-1001n)?.tpState).toBe("confirming");
    expect(store.get(-1001n)?.slState).toBe("canceled");
    expect(store.get(-1001n)?.tempQuoteId).toBe(-1001n);
  });

  it("`link` binds two ids to the same record", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(-1001n, "tp");
    store.link(-1001n, 42n);
    const viaTemp = store.get(-1001n);
    const viaChain = store.get(42n);
    expect(viaChain).toBe(viaTemp);
    expect(viaChain?.tempQuoteId).toBe(-1001n);
    expect(viaChain?.quoteId).toBe(42n);
  });

  it("`link` seeds an empty record when neither id is indexed", () => {
    const store = useTpSlStore.getState();
    store.link(-5n, 99n);
    expect(store.get(-5n)).toBe(store.get(99n));
    expect(store.get(-5n)?.tempQuoteId).toBe(-5n);
    expect(store.get(-5n)?.quoteId).toBe(99n);
  });

  it("`link` merges two separate records, preferring A's fields for canceled sides", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(-1001n, "tp");
    store.markConfirming(42n, "sl");
    store.link(-1001n, 42n);
    const record = store.get(-1001n);
    expect(record).toBe(store.get(42n));
    expect(record?.tpState).toBe("confirming");
    expect(record?.slState).toBe("confirming");
  });

  it("`setRows` folds trigger and open prices onto the record", () => {
    const store = useTpSlStore.getState();
    store.setRows(7n, [
      row({
        conditional_order_type: "take_profit",
        conditional_order_price: 150,
        price: 100,
        state: "new",
      }),
      row({
        conditional_order_type: "stop_loss",
        conditional_order_price: 80,
        state: "new",
      }),
    ]);
    const record = store.get(7n)!;
    expect(record.tp).toBe("150");
    expect(record.sl).toBe("80");
    expect(record.tpState).toBe("new");
    expect(record.slState).toBe("new");
  });

  it("`setRows` auto-indexes the row's `quote_id` next to the queried id", () => {
    const store = useTpSlStore.getState();
    store.setRows(-1001n, [row({ quote_id: 42, coh_quote_id: "coh42", state: "pending" })]);
    expect(store.get(42n)).toBe(store.get(-1001n));
  });

  it("`applyNotification` transitions a confirming side to the wire state", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp");
    store.applyNotification(42n, notification({ state: "new" }));
    expect(store.get(42n)?.tpState).toBe("new");
    expect(store.get(42n)?.tpCohQuoteId).toBe("coh42");
  });

  it("`applyNotification` picks up `trigger_price` from `details` when present", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp");
    store.applyNotification(42n, notification({ details: { trigger_price: 200 } }));
    expect(store.get(42n)?.tp).toBe("200");
  });

  it("`applyNotification` ignores a `successful: false` frame", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp");
    store.applyNotification(42n, notification({ successful: false }));
    expect(store.get(42n)?.tpState).toBe("confirming");
  });

  it("`applyNotification` clears the confirmation guard once the report lands", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp", { price: "150" });
    store.applyNotification(42n, notification({ state: "new" }));
    expect(store.get(42n)?.tpConfirm).toBeUndefined();
  });

  it("`setRows` does not erase a pending write the handler has yet to publish", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp", { price: "150", cohQuoteId: "coh42" });
    // The refetch beat the handler's own bookkeeping and came back empty.
    store.setRows(42n, []);
    const record = store.get(42n)!;
    expect(record.tpState).toBe("confirming");
    expect(record.tp).toBe("150");
    expect(record.tpCohQuoteId).toBe("coh42");
  });

  it("`setRows` settles a pending write on a snapshot showing the submitted price", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp", { price: "150" });
    store.setRows(42n, [row({ quote_id: 42, state: "new", conditional_order_price: 150 })]);
    const record = store.get(42n)!;
    expect(record.tpState).toBe("new");
    expect(record.tp).toBe("150");
    expect(record.tpConfirm).toBeUndefined();
  });

  it("`setRows` holds a pending write when the snapshot still shows the pre-edit price", () => {
    const store = useTpSlStore.getState();
    // The trader edits an existing TP from 150 to 160; the refetch beats the
    // handler and still returns the old row. That row is not evidence the edit
    // landed, so the side keeps waiting instead of reporting a stale success.
    store.markConfirming(42n, "tp", { price: "160", priceType: "markPrice" });
    store.setRows(42n, [row({ quote_id: 42, state: "new", conditional_order_price: 150 })]);
    const record = store.get(42n)!;
    expect(record.tpState).toBe("confirming");
    expect(record.tp).toBe("160");
  });

  it("`setRows` settles a pending write on a matching handler id, whatever the price says", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp", { price: "160", cohQuoteId: "coh-new" });
    store.setRows(42n, [
      row({ quote_id: 42, state: "new", conditional_order_price: 160.0000000001, coh_quote_id: "coh-new" }),
    ]);
    expect(store.get(42n)?.tpState).toBe("new");
  });

  it("`setRows` holds a pending write when the handler id belongs to the order being replaced", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp", { price: "160", cohQuoteId: "coh-new" });
    store.setRows(42n, [row({ quote_id: 42, state: "new", conditional_order_price: 160, coh_quote_id: "coh-old" })]);
    expect(store.get(42n)?.tpState).toBe("confirming");
  });

  it("`setRows` settles a write that seeded no evidence, as it always did", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp");
    store.setRows(42n, [row({ quote_id: 42, state: "new", conditional_order_price: 155 })]);
    expect(store.get(42n)?.tpState).toBe("new");
  });

  it("`setRowsForSides` leaves the sides it was not given alone", () => {
    const store = useTpSlStore.getState();
    // A live TP the caller is not asking about, and an SL edit it is.
    store.setRows(42n, [
      row({ quote_id: 42, state: "new", conditional_order_price: 150 }),
      row({ quote_id: 42, conditional_order_type: "stop_loss", state: "new", conditional_order_price: 80 }),
    ]);
    store.markConfirming(42n, "sl", { price: "90" });

    // An account-scoped page that lagged and carries neither side.
    store.setRowsForSides(42n, [], ["sl"]);

    const record = store.get(42n)!;
    expect(record.tpState).toBe("new");
    expect(record.tp).toBe("150");
    expect(record.slState).toBe("confirming");
  });

  it("`setRowsForSides` never aliases a foreign quote id onto the record", () => {
    const store = useTpSlStore.getState();
    store.setRowsForSides(42n, [row({ quote_id: 99, state: "new" })], ["tp"]);
    expect(store.get(99n)).toBeUndefined();
  });

  it("skips the commit entirely when a fold changes nothing", () => {
    const store = useTpSlStore.getState();
    store.setRows(42n, [row({ quote_id: 42, state: "new", conditional_order_price: 150 })]);
    const before = useTpSlStore.getState().records;

    store.setRows(42n, [row({ quote_id: 42, state: "new", conditional_order_price: 150 })]);

    // Same state object — zustand notifies no subscriber, so a repeating sweep
    // does not wake every waiter or re-render every cell on each tick.
    expect(useTpSlStore.getState().records).toBe(before);
  });

  it("`setRows` confirms a pending cancel by the side's absence", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp", { intent: "cancel" });
    store.setRows(42n, []);
    const record = store.get(42n)!;
    expect(record.tpState).toBe("canceled");
    expect(record.tpConfirm).toBeUndefined();
  });

  it("`clearConfirming` hands the next snapshot back the wheel", () => {
    const store = useTpSlStore.getState();
    store.markConfirming(42n, "tp", { price: "150" });
    store.clearConfirming(42n, "tp");
    store.setRows(42n, []);
    expect(store.get(42n)?.tpState).toBe("canceled");
  });
});
