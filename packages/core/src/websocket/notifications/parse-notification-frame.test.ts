import { describe, expect, it } from "vitest";
import { parseNotificationFrame } from "./parse-notification-frame";

const notification = { id: "n1", quote_id: 7, temp_quote_id: -1, action_status: "success" };

describe("parseNotificationFrame", () => {
  it("unwraps a defilytics envelope and hoists the top-level address", () => {
    const frame = parseNotificationFrame(JSON.stringify({ data: notification, address: "0xsubaccount" }), "defilytics");
    expect(frame?.id).toBe("n1");
    expect(frame?.address).toBe("0xsubaccount");
  });

  it("accepts an already-parsed object", () => {
    const frame = parseNotificationFrame({ data: notification, address: "0xacc" }, "defilytics");
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
      "defilytics",
    );
    expect(frame).not.toBeNull();
    expect(frame?.id).toBeUndefined();
    expect(frame?.last_seen_action).toBe("InstantRFQ");
    expect(frame?.address).toBe("0xsubaccount");
  });

  it("returns null for malformed JSON", () => {
    expect(parseNotificationFrame("{not json", "defilytics")).toBeNull();
  });

  it("returns null for control/ack frames without a data payload", () => {
    expect(parseNotificationFrame(JSON.stringify({ ack: true }), "defilytics")).toBeNull();
  });
});
