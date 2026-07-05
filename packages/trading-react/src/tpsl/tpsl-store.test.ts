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
});
