import { describe, expect, it } from "vitest";
import { parseTpSlFrame } from "./parse-tpsl-frame";

const LIVE_FRAME = {
  app_name: "Hyper-EVM_COH-Low-Cap_Production",
  primary_identifier: 9565,
  secondary_identifier: 0,
  address: "0xaE96C48Cb4D3ECff70E31bddeFb87edc1C41e64D",
  data: {
    coh_quote_id: "coh740",
    conditional_order_type: "stop_loss",
    state: "edit",
    details: { sent_time: 1782821981.8538036 },
    successful: true,
  },
  type: "report",
  timestamp: 1782821982,
} as const;

describe("parseTpSlFrame", () => {
  it("parses a live handler `report` frame (object input)", () => {
    const notification = parseTpSlFrame(LIVE_FRAME);
    expect(notification).not.toBeNull();
    expect(notification).toMatchObject({
      quoteId: 9565,
      primaryIdentifier: 9565,
      secondaryIdentifier: 0,
      account: "0xaE96C48Cb4D3ECff70E31bddeFb87edc1C41e64D",
      conditionalOrderType: "stop_loss",
      state: "edit",
      successful: true,
      cohQuoteId: "coh740",
      timestamp: 1782821982,
    });
    expect(notification?.details).toEqual({ sent_time: 1782821981.8538036 });
    expect(notification?.errorCode).toBeUndefined();
    expect(notification?.errorMessage).toBeUndefined();
  });

  it("parses the same frame delivered as a JSON string", () => {
    const notification = parseTpSlFrame(JSON.stringify(LIVE_FRAME));
    expect(notification?.quoteId).toBe(9565);
    expect(notification?.state).toBe("edit");
  });

  it("falls back to secondary_identifier while pre-chain", () => {
    const notification = parseTpSlFrame({
      ...LIVE_FRAME,
      primary_identifier: 0,
      secondary_identifier: -1,
    });
    expect(notification?.quoteId).toBe(-1);
    expect(notification?.primaryIdentifier).toBe(0);
    expect(notification?.secondaryIdentifier).toBe(-1);
  });

  it("surfaces error fields on unsuccessful frames", () => {
    const notification = parseTpSlFrame({
      ...LIVE_FRAME,
      data: {
        coh_quote_id: "coh740",
        conditional_order_type: "take_profit",
        state: "cancel",
        successful: false,
        error_code: 42,
        error_message: "boom",
      },
    });
    expect(notification?.successful).toBe(false);
    expect(notification?.errorCode).toBe(42);
    expect(notification?.errorMessage).toBe("boom");
    expect(notification?.details).toBeUndefined();
  });

  it("returns null for non-`report` frames", () => {
    expect(parseTpSlFrame({ ...LIVE_FRAME, type: "alarm" })).toBeNull();
  });

  it("returns null when the payload is missing", () => {
    expect(parseTpSlFrame({ ...LIVE_FRAME, data: undefined })).toBeNull();
    expect(parseTpSlFrame({ type: "report" })).toBeNull();
  });

  it("returns null for malformed JSON strings and non-objects", () => {
    expect(parseTpSlFrame("not-json")).toBeNull();
    expect(parseTpSlFrame(null)).toBeNull();
    expect(parseTpSlFrame(42)).toBeNull();
  });
});
