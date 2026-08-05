import { describe, expect, it } from "vitest";
import { parseNotificationFrame } from "./parse-notification-frame";

const notification = { id: "n1", quote_id: 7, temp_quote_id: -1, action_status: "success" };

describe("parseNotificationFrame", () => {
  it("unwraps a enigma envelope and hoists the top-level address", () => {
    const frame = parseNotificationFrame(JSON.stringify({ data: notification, address: "0xsubaccount" }), "enigma");
    expect(frame?.id).toBe("n1");
    expect(frame?.address).toBe("0xsubaccount");
  });

  it("accepts an already-parsed object", () => {
    const frame = parseNotificationFrame({ data: notification, address: "0xacc" }, "enigma");
    expect(frame?.id).toBe("n1");
  });

  it("parses a payload that omits `id` (e.g. an InstantRFQ report)", () => {
    const frame = parseNotificationFrame(
      JSON.stringify({
        app_name: "Hyper-evm_Solver-lowcap_Stage",
        primary_identifier: 0,
        secondary_identifier: null,
        address: "0xsubaccount",
        data: {
          action_status: "success",
          avg_price_open: "0.007881",
          last_seen_action: "InstantRFQ",
          temp_quote_id: -3,
        },
      }),
      "enigma",
    );
    expect(frame).not.toBeNull();
    expect(frame?.id).toBeUndefined();
    expect(frame?.last_seen_action).toBe("InstantRFQ");
    expect(frame?.address).toBe("0xsubaccount");
  });

  it("returns null for malformed JSON", () => {
    expect(parseNotificationFrame("{not json", "enigma")).toBeNull();
  });

  it("returns null for control/ack frames without a data payload", () => {
    expect(parseNotificationFrame(JSON.stringify({ ack: true }), "enigma")).toBeNull();
  });
});

describe("parseNotificationFrame — rasa", () => {
  /** A close-flow report frame as captured from the live rasa endpoint. */
  const closeReport = {
    id: "ecbaca8f-c76d-4182-a68f-737d80ffca7c",
    create_time: 1785909531,
    modify_time: 1785909531,
    quote_id: 228234,
    temp_quote_id: -711,
    counterparty_address: "0x6A51fBB6F869c872c2e4C19C6bBBb77a03785C7C",
    state_type: "report",
    filled_amount_open: 0,
    filled_amount_close: "9.600000000000000000",
    avg_price_open: 0,
    avg_price_close: "1.0696",
    last_seen_action: "InstantRequestToClosePosition",
    action_status: "success",
    failure_type: null,
    error_code: 0,
    order_type: 1,
  };

  it("passes a bare frame through wire-faithful, zero-sentinels included", () => {
    const frame = parseNotificationFrame(JSON.stringify(closeReport), "rasa");
    expect(frame).not.toBeNull();
    expect(frame?.quote_id).toBe(228234);
    expect(frame?.temp_quote_id).toBe(-711);
    // Nothing is coerced here — `normalizeNotification` reconciles the
    // numeric zero-sentinels; the raw frame stays as sent.
    expect(frame?.filled_amount_close).toBe("9.600000000000000000");
    expect(frame?.avg_price_close).toBe("1.0696");
    expect(frame?.filled_amount_open).toBe(0);
    expect(frame?.avg_price_open).toBe(0);
    // Rasa-only fields survive on the variant.
    expect(frame?.order_type).toBe(1);
    // No address on the wire — the watcher stamps it.
    expect(frame?.address).toBeUndefined();
  });

  it("returns null for frames without a quote id (acks/keepalives)", () => {
    expect(parseNotificationFrame(JSON.stringify({ ok: true }), "rasa")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseNotificationFrame("{not json", "rasa")).toBeNull();
  });
});
