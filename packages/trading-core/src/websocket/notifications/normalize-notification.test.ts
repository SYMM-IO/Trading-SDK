import { describe, expect, it } from "vitest";
import { classifyNotification, normalizeNotification } from "./normalize-notification";
import { NotificationType, type RawEnigmaPositionNotification, type RawRasaPositionNotification } from "./types";

function rawFrame(overrides: Partial<RawEnigmaPositionNotification> = {}): RawEnigmaPositionNotification {
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

  /** The rasa wire variant: numeric zero-sentinels, no `va_address` / `failure_message`. */
  it("reconciles a rasa frame's numeric zero-sentinels and enigma-only gaps", () => {
    const rasa: RawRasaPositionNotification = {
      id: "r1",
      quote_id: -712,
      temp_quote_id: -712,
      counterparty_address: "0xsubaccount",
      address: "0xsubaccount",
      state_type: "report",
      filled_amount_open: "8.500000000000000000",
      filled_amount_close: 0,
      avg_price_open: "1.0684",
      avg_price_close: 0,
      last_seen_action: "InstantRFQ",
      action_status: "success",
      failure_type: null,
      error_code: 0,
      order_type: 1,
    };
    const n = normalizeNotification(rasa);

    // Numeric `0` means "no value"; decimal strings pass through.
    expect(n.filledAmountOpen).toBe("8.500000000000000000");
    expect(n.filledAmountClose).toBeNull();
    expect(n.avgPriceOpen).toBe("1.0684");
    expect(n.avgPriceClose).toBe("");
    // Enigma-only fields default cleanly on the rasa variant.
    expect(n.vaAddress).toBeNull();
    expect(n.failureMessage).toBeNull();
    // The wire-faithful frame is preserved, sentinels included.
    expect(n.raw).toBe(rasa);
    expect((n.raw as RawRasaPositionNotification).filled_amount_close).toBe(0);
  });

  it("keeps a defensive nonzero numeric value as its string form", () => {
    const n = normalizeNotification({ temp_quote_id: -1, avg_price_close: 1.07 } as RawRasaPositionNotification);
    expect(n.avgPriceClose).toBe("1.07");
  });
});
