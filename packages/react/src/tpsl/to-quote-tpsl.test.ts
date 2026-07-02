import type { QuoteTpSlRow } from "@symm-frontier/core";
import { describe, expect, it } from "vitest";
import { toQuoteTpSl } from "./to-quote-tpsl";

function row(overrides: Record<string, unknown> = {}): QuoteTpSlRow {
  return {
    quote_id: 9469,
    coh_quote_id: "coh709",
    party_a_address: "0x4AF4CD703760c4F018cef5059a43B2624cdeB038",
    symbol_id: 1,
    conditional_order_type: "take_profit",
    quantity: 163.39869,
    price: 1.3,
    conditional_order_price: 13,
    order_type: 1,
    state: "new",
    action_price_type: "last_close",
    close_status: null,
    position_type: 0,
    leverage: null,
    create_time: 1782689029,
    modify_time: 1782795819,
    ...overrides,
  } as unknown as QuoteTpSlRow;
}

describe("toQuoteTpSl", () => {
  it("returns an empty snapshot with `canceled` sentinel states when no rows arrive", () => {
    expect(toQuoteTpSl([])).toEqual({
      tp: "",
      sl: "",
      tpOpenPrice: "",
      slOpenPrice: "",
      tpPriceType: "markPrice",
      slPriceType: "markPrice",
      tpState: "canceled",
      slState: "canceled",
      tpCohQuoteId: undefined,
      slCohQuoteId: undefined,
    });
    expect(toQuoteTpSl(null)).toEqual(toQuoteTpSl([]));
    expect(toQuoteTpSl(undefined)).toEqual(toQuoteTpSl([]));
  });

  it("folds a matching TP + SL pair using the live API sample", () => {
    const snapshot = toQuoteTpSl([
      row({
        conditional_order_type: "take_profit",
        price: 1.3,
        conditional_order_price: 13,
        action_price_type: "last_close",
        state: "new",
        modify_time: 1782795819,
      }),
      row({
        conditional_order_type: "stop_loss",
        price: 0.0001,
        conditional_order_price: 0.001,
        action_price_type: "market",
        state: "new",
        modify_time: 1782795819,
      }),
    ]);
    expect(snapshot).toMatchObject({
      tp: "13",
      tpOpenPrice: "1.3",
      tpPriceType: "lastPrice",
      tpState: "new",
      tpCohQuoteId: "coh709",
      sl: "0.001",
      slOpenPrice: "0.0001",
      slPriceType: "markPrice",
      slState: "new",
      slCohQuoteId: "coh709",
    });
  });

  it("skips terminated (`canceled` / `killed`) rows", () => {
    const snapshot = toQuoteTpSl([
      row({ conditional_order_type: "take_profit", state: "canceled" }),
      row({ conditional_order_type: "stop_loss", state: "killed" }),
    ]);
    expect(snapshot.tp).toBe("");
    expect(snapshot.tpState).toBe("canceled");
    expect(snapshot.sl).toBe("");
    expect(snapshot.slState).toBe("canceled");
  });

  it("keeps the row with the highest `modify_time` per side", () => {
    const snapshot = toQuoteTpSl([
      row({
        conditional_order_type: "take_profit",
        conditional_order_price: 10,
        state: "new",
        coh_quote_id: "coh-old",
        modify_time: 1_000,
      }),
      row({
        conditional_order_type: "take_profit",
        conditional_order_price: 25,
        state: "pending",
        coh_quote_id: "coh-new",
        modify_time: 2_000,
      }),
    ]);
    expect(snapshot.tp).toBe("25");
    expect(snapshot.tpState).toBe("pending");
    expect(snapshot.tpCohQuoteId).toBe("coh-new");
  });

  it("maps every active row state onto the SDK's TpSlInfoState", () => {
    const snapshot = toQuoteTpSl([
      row({ conditional_order_type: "take_profit", state: "triggered_pending" }),
      row({ conditional_order_type: "stop_loss", state: "triggered" }),
    ]);
    expect(snapshot.tpState).toBe("triggered");
    expect(snapshot.slState).toBe("triggered");
  });

  it("treats a null `price` as empty open-price and unknown `action_price_type` as markPrice", () => {
    const snapshot = toQuoteTpSl([
      row({
        conditional_order_type: "take_profit",
        price: null,
        // simulate a spec drift: unknown priceType flavor
        action_price_type: undefined as unknown as QuoteTpSlRow["action_price_type"],
      }),
    ]);
    expect(snapshot.tpOpenPrice).toBe("");
    expect(snapshot.tpPriceType).toBe("markPrice");
  });
});
