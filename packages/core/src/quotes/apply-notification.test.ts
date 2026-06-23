import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { OrderType, PositionType } from "../symmio-contracts/symmio/types";
import { NotificationType, type Notification } from "../websocket/notifications/types";
import { applyNotificationToQuotes } from "./apply-notification";
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

  it("stamps the optimistic CLOSING on a not-yet-anchored (off-chain) row", () => {
    const row = makeRow({
      key: "temp:-5",
      origin: "offchain",
      lifecycle: QuoteLifecycle.OPTIMISTIC,
      quoteId: undefined,
      tempQuoteId: -5,
    });
    const result = apply1(row, makeCloseNotification({ quoteId: "-5", tempQuoteId: -5 }));
    expect(result.lifecycle).toBe(QuoteLifecycle.CLOSING);
  });

  it("still captures the closed price from the notification without changing an anchored lifecycle", () => {
    const result = apply1(
      makeRow({ lifecycle: QuoteLifecycle.ONCHAIN, avgClosedPrice: undefined }),
      makeCloseNotification({ avgPriceClose: "1.5" }),
    );
    expect(result.avgClosedPrice).toBe(1_500000000000000000n);
    expect(result.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("leaves a row untouched when the notification does not match it", () => {
    const row = makeRow({ lifecycle: QuoteLifecycle.ONCHAIN });
    const result = apply1(row, makeCloseNotification({ quoteId: "9999" }));
    expect(result).toBe(row);
  });
});
