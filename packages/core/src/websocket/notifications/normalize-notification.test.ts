import { describe, expect, it } from "vitest";
import { classifyNotification, normalizeNotification } from "./normalize-notification";
import { NotificationType, type RawPositionNotification } from "./types";

function rawFrame(overrides: Partial<RawPositionNotification> = {}): RawPositionNotification {
  return {
    id: "n1",
    quote_id: 0,
    temp_quote_id: -5,
    create_time: 1,
    modify_time: 2,
    counterparty_address: "0xpartyb",
    address: "0xsubaccount",
    filled_amount_open: null,
    filled_amount_close: null,
    last_seen_action: "SendQuoteTransaction",
    action_status: "success",
    failure_type: null,
    failure_message: null,
    error_code: null,
    state_type: "report",
    avg_price_open: "10",
    avg_price_close: "0",
    ...overrides,
  };
}

describe("classifyNotification", () => {
  it("maps known statuses and defaults unknown/missing to FAILED", () => {
    expect(classifyNotification("success")).toBe(NotificationType.SUCCESS);
    expect(classifyNotification("seen")).toBe(NotificationType.SEEN);
    expect(classifyNotification("failed")).toBe(NotificationType.FAILED);
    expect(classifyNotification("weird")).toBe(NotificationType.FAILED);
    expect(classifyNotification(null)).toBe(NotificationType.FAILED);
  });
});

describe("normalizeNotification", () => {
  it("resolves quoteId from temp_quote_id when no on-chain id exists", () => {
    expect(normalizeNotification(rawFrame({ quote_id: 0, temp_quote_id: -5 })).quoteId).toBe("-5");
  });

  it("prefers the on-chain quote_id when present", () => {
    expect(normalizeNotification(rawFrame({ quote_id: 42, temp_quote_id: -5 })).quoteId).toBe("42");
  });

  it("maps fields to camelCase, classifies, and preserves the raw frame", () => {
    const n = normalizeNotification(rawFrame());
    expect(n.account).toBe("0xsubaccount");
    expect(n.lastSeenAction).toBe("SendQuoteTransaction");
    expect(n.type).toBe(NotificationType.SUCCESS);
    expect(n.createTime).toBe("1");
    expect(n.raw.id).toBe("n1");
  });

  it("normalizes a sparse frame that omits id and most fields", () => {
    const n = normalizeNotification({
      action_status: "success",
      avg_price_open: "0.007881",
      last_seen_action: "InstantRFQ",
      temp_quote_id: -3,
    });
    expect(n.id).toBe("");
    expect(n.quoteId).toBe("-3");
    expect(n.type).toBe(NotificationType.SUCCESS);
    expect(n.lastSeenAction).toBe("InstantRFQ");
    expect(n.counterpartyAddress).toBe("");
    expect(n.filledAmountOpen).toBeNull();
  });
});
