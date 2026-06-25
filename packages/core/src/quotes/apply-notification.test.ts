import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { OrderType, PositionType, type Quote } from "../symmio-contracts/symmio/types";
import { NotificationType, type Notification } from "../websocket/notifications/types";
import { applyNotificationToQuotes, classifyQuoteNotificationAction } from "./apply-notification";
import { QuoteLifecycle, type UnifiedQuote } from "./unified-quote";

const PARTY_A = "0x000000000000000000000000000000000000a11a" as Address;

/** Build a minimal {@link UnifiedQuote} with sane defaults; override what a case needs. */
function makeRow(overrides: Partial<UnifiedQuote> = {}): UnifiedQuote {
  return {
    key: "onchain:7293",
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 7293n,
    partyA: PARTY_A,
    symbolId: 1n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    requestedOpenPrice: 0n,
    quantity: 142_191812000000000000n,
    closedAmount: 100_000000000000000000n,
    openQuantity: 42_191812000000000000n,
    lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
    raw: {},
    ...overrides,
  };
}

/** Build a minimal close-action {@link Notification}; defaults to a successful instant-close fill of #7293. */
function makeCloseNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    quoteId: "7293",
    tempQuoteId: 0,
    type: NotificationType.SUCCESS,
    actionStatus: "success",
    lastSeenAction: "FillMarketOrderInstantClose",
    account: PARTY_A,
    vaAddress: null,
    counterpartyAddress: "",
    filledAmountOpen: null,
    filledAmountClose: null,
    avgPriceOpen: "",
    avgPriceClose: "",
    failureType: null,
    failureMessage: null,
    errorCode: null,
    stateType: null,
    createTime: "",
    modifyTime: "",
    raw: {},
    ...overrides,
  };
}

/** Apply one notification to one row and return the single resulting row. */
function apply1(row: UnifiedQuote, notification: Notification): UnifiedQuote {
  const [result] = applyNotificationToQuotes([row], notification);
  if (!result) throw new Error("expected exactly one row");
  return result;
}

describe("applyNotificationToQuotes — close lifecycle", () => {
  it("does NOT re-stamp CLOSING on a settled partial close anchored on-chain (regression for stuck-CLOSING)", () => {
    const result = apply1(makeRow({ lifecycle: QuoteLifecycle.ONCHAIN, origin: "onchain" }), makeCloseNotification());
    expect(result.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("stays ONCHAIN no matter how many times the close notification is replayed", () => {
    let rows = [makeRow({ lifecycle: QuoteLifecycle.ONCHAIN })];
    const notification = makeCloseNotification();
    for (let i = 0; i < 5; i++) rows = applyNotificationToQuotes(rows, notification);
    expect(rows[0]?.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("treats a close REQUEST action the same — an anchored OPENED row is not dragged to CLOSING", () => {
    const result = apply1(
      makeRow({ lifecycle: QuoteLifecycle.ONCHAIN }),
      makeCloseNotification({ lastSeenAction: "InstantRequestToClosePosition" }),
    );
    expect(result.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("keeps an anchored CLOSE_PENDING row CLOSING (authoritative on-chain status drives it)", () => {
    const result = apply1(makeRow({ lifecycle: QuoteLifecycle.CLOSING }), makeCloseNotification());
    expect(result.lifecycle).toBe(QuoteLifecycle.CLOSING);
  });

  it("never overrides a terminal CLOSED row", () => {
    const result = apply1(makeRow({ lifecycle: QuoteLifecycle.CLOSED }), makeCloseNotification());
    expect(result.lifecycle).toBe(QuoteLifecycle.CLOSED);
  });

  it("advances a not-yet-anchored (off-chain) close to WRITE_ONCHAIN_CLOSE on the fill action", () => {
    const row = makeRow({
      key: "temp:-5",
      origin: "offchain",
      lifecycle: QuoteLifecycle.OPTIMISTIC,
      quoteId: undefined,
      tempQuoteId: -5,
    });
    const result = apply1(row, makeCloseNotification({ quoteId: "-5", tempQuoteId: -5 }));
    expect(result.lifecycle).toBe(QuoteLifecycle.WRITE_ONCHAIN_CLOSE);
  });

  it("still captures the closed price from the notification without changing an anchored lifecycle", () => {
    const result = apply1(
      makeRow({ lifecycle: QuoteLifecycle.ONCHAIN, closedPrice: undefined }),
      makeCloseNotification({ avgPriceClose: "1.5" }),
    );
    expect(result.closedPrice).toBe(1_500000000000000000n);
    expect(result.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("leaves a row untouched when the notification does not match it", () => {
    const row = makeRow({ lifecycle: QuoteLifecycle.ONCHAIN });
    const result = apply1(row, makeCloseNotification({ quoteId: "9999" }));
    expect(result).toBe(row);
  });
});

describe("applyNotificationToQuotes — close staging", () => {
  it("advances an in-flight close OPTIMISTIC_CLOSE → CLOSE_PRICE_FILLED on the request notification", () => {
    const result = apply1(
      makeRow({ lifecycle: QuoteLifecycle.OPTIMISTIC_CLOSE }),
      makeCloseNotification({ lastSeenAction: "InstantRequestToClosePosition" }),
    );
    expect(result.lifecycle).toBe(QuoteLifecycle.CLOSE_PRICE_FILLED);
  });

  it("advances CLOSE_PRICE_FILLED → WRITE_ONCHAIN_CLOSE on the fill notification", () => {
    const result = apply1(
      makeRow({ lifecycle: QuoteLifecycle.CLOSE_PRICE_FILLED }),
      makeCloseNotification({ lastSeenAction: "FillMarketOrderInstantClose" }),
    );
    expect(result.lifecycle).toBe(QuoteLifecycle.WRITE_ONCHAIN_CLOSE);
  });

  it("does not regress the poll-confirmed CLOSING when the earlier request notification replays", () => {
    const result = apply1(
      makeRow({ lifecycle: QuoteLifecycle.CLOSING }),
      makeCloseNotification({ lastSeenAction: "InstantRequestToClosePosition" }),
    );
    expect(result.lifecycle).toBe(QuoteLifecycle.CLOSING);
  });

  it("ignores replayed close notifications on a settled ONCHAIN row (no re-stick)", () => {
    let rows = [makeRow({ lifecycle: QuoteLifecycle.ONCHAIN })];
    for (const action of ["InstantRequestToClosePosition", "FillMarketOrderInstantClose"]) {
      rows = applyNotificationToQuotes(rows, makeCloseNotification({ lastSeenAction: action }));
      rows = applyNotificationToQuotes(rows, makeCloseNotification({ lastSeenAction: action }));
    }
    expect(rows[0]?.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });
});

describe("applyNotificationToQuotes — open anchor (write-onchain)", () => {
  it("rekeys an off-chain row and sets WRITE_ONCHAIN when no on-chain struct is present yet", () => {
    const row = makeRow({
      key: "temp:-5",
      origin: "offchain",
      lifecycle: QuoteLifecycle.OPTIMISTIC,
      quoteId: undefined,
      tempQuoteId: -5,
      raw: {},
    });
    const result = apply1(
      row,
      makeCloseNotification({ quoteId: "55", tempQuoteId: -5, lastSeenAction: "SendQuoteTransaction" }),
    );
    expect(result.key).toBe("onchain:55");
    expect(result.quoteId).toBe(55n);
    expect(result.origin).toBe("onchain");
    expect(result.lifecycle).toBe(QuoteLifecycle.WRITE_ONCHAIN);
  });

  it("does not downgrade an already-read on-chain row to WRITE_ONCHAIN (polled status wins)", () => {
    const row = makeRow({ lifecycle: QuoteLifecycle.ONCHAIN, raw: { onchain: { id: 7293n } as unknown as Quote } });
    const result = apply1(row, makeCloseNotification({ quoteId: "7293", lastSeenAction: "SendQuoteTransaction" }));
    expect(result.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });
});

describe("applyNotificationToQuotes — failure guard", () => {
  it("does NOT mark a confirmed on-chain row FAILED — a failed action leaves the position live", () => {
    const row = makeRow({ lifecycle: QuoteLifecycle.ONCHAIN, raw: { onchain: { id: 7293n } as unknown as Quote } });
    const result = apply1(row, makeCloseNotification({ type: NotificationType.FAILED, actionStatus: "failed" }));
    expect(result.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("stays ONCHAIN no matter how many times the failure is replayed (retry stays possible)", () => {
    let rows = [makeRow({ lifecycle: QuoteLifecycle.ONCHAIN, raw: { onchain: { id: 7293n } as unknown as Quote } })];
    const fail = makeCloseNotification({ type: NotificationType.FAILED, actionStatus: "failed" });
    for (let i = 0; i < 5; i++) rows = applyNotificationToQuotes(rows, fail);
    expect(rows[0]?.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("does NOT flash FAILED on an off-chain optimistic open — it just vanishes when the hedger drops it", () => {
    const row = makeRow({
      key: "temp:-5",
      origin: "offchain",
      lifecycle: QuoteLifecycle.OPTIMISTIC,
      quoteId: undefined,
      tempQuoteId: -5,
      raw: {},
    });
    const result = apply1(
      row,
      makeCloseNotification({ quoteId: "-5", tempQuoteId: -5, type: NotificationType.FAILED, actionStatus: "failed" }),
    );
    expect(result.lifecycle).toBe(QuoteLifecycle.OPTIMISTIC);
  });

  it("marks an anchored-but-unread (WRITE_ONCHAIN) row FAILED so a reverted anchor drops cleanly", () => {
    const row = makeRow({ lifecycle: QuoteLifecycle.WRITE_ONCHAIN, raw: {} });
    const result = apply1(row, makeCloseNotification({ type: NotificationType.FAILED, actionStatus: "failed" }));
    expect(result.lifecycle).toBe(QuoteLifecycle.FAILED);
  });
});

describe("classifyQuoteNotificationAction", () => {
  it("classifies open-anchor and price-fill actions as open", () => {
    expect(classifyQuoteNotificationAction("SendQuoteTransaction")).toBe("open");
    expect(classifyQuoteNotificationAction("FillLimitOrderOpen")).toBe("open");
    expect(classifyQuoteNotificationAction("InstantRFQ")).toBe("open");
  });

  it("classifies close-request/fill actions as close", () => {
    expect(classifyQuoteNotificationAction("FillMarketOrderInstantClose")).toBe("close");
    expect(classifyQuoteNotificationAction("RequestToClosePosition")).toBe("close");
  });

  it("classifies unknown or missing actions as other", () => {
    expect(classifyQuoteNotificationAction("SomethingElse")).toBe("other");
    expect(classifyQuoteNotificationAction(undefined)).toBe("other");
  });
});
