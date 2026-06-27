import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { PendingInstantClose } from "../solvers/instant-close/get-instant-closes/to-pending-instant-close";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/to-pending-instant-open";
import { OrderType, PositionType, QuoteStatus, type Quote } from "../symmio-contracts/symmio/types";
import { quoteOpenQuantity } from "./open-quantity";
import {
  lifecycleFromQuoteStatus,
  toUnifiedQuoteFromInstantClose,
  toUnifiedQuoteFromInstantOpen,
  toUnifiedQuoteFromOnchain,
} from "./to-unified-quote";
import { QuoteLifecycle } from "./unified-quote";

/** Deterministic partyA/partyB addresses for raw-struct fixtures. */
const PARTY_A: Address = "0x1111111111111111111111111111111111111111";
const PARTY_B: Address = "0x3333333333333333333333333333333333333333";
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

/**
 * Build a complete raw on-chain {@link Quote}. These transforms consume the raw
 * contract struct (not a UnifiedQuote), so every required field must be present.
 * Defaults to a partially-closed `CLOSE_PENDING` long market position so a single
 * fixture exercises both a non-zero `closedAmount` and the `CLOSING` lifecycle.
 *
 * @param overrides - Fields to override on the default quote.
 * @returns A fully-populated raw quote struct.
 */
function makeQuote(overrides: Partial<Quote> = {}): Quote {
  const base: Quote = {
    id: 42n,
    partyBsWhiteList: [],
    symbolId: 7n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    openedPrice: 2_000000000000000000n,
    initialOpenedPrice: 1_900000000000000000n,
    requestedOpenPrice: 1_950000000000000000n,
    marketPrice: 2_010000000000000000n,
    quantity: 10_000000000000000000n,
    closedAmount: 4_000000000000000000n,
    initialLockedValues: { cva: 1n, lf: 2n, partyAmm: 3n, partyBmm: 4n },
    lockedValues: { cva: 10n, lf: 20n, partyAmm: 30n, partyBmm: 40n },
    maxFundingRate: 0n,
    partyA: PARTY_A,
    partyB: PARTY_B,
    quoteStatus: QuoteStatus.CLOSE_PENDING,
    avgClosedPrice: 2_050000000000000000n,
    requestedClosePrice: 2_060000000000000000n,
    quantityToClose: 3_000000000000000000n,
    parentId: 0n,
    createTimestamp: 1_700n,
    statusModifyTimestamp: 1_800n,
    lastFundingPaymentTimestamp: 1_750n,
    deadline: 9_999n,
    tradingFee: 0n,
    affiliate: ZERO_ADDRESS,
    accumulatedPaidFunding: 0n,
    closeFee: 0n,
    data: "0x" as Hex,
  };
  return { ...base, ...overrides };
}

/**
 * Build a raw pending instant-open record. Amount fields are human-scaled decimal
 * strings (the hedger's wire shape), so the transform under test normalizes them
 * to wei via `toWeiBigInt`.
 *
 * @param overrides - Fields to override on the default record.
 * @returns A pending instant-open with human-decimal amounts.
 */
function makePendingInstantOpen(overrides: Partial<PendingInstantOpen> = {}): PendingInstantOpen {
  const base: PendingInstantOpen = {
    tempQuoteId: 99,
    marketId: 7,
    positionType: PositionType.SHORT,
    orderType: OrderType.LIMIT,
    partyA: PARTY_A,
    requestedOpenPrice: "2.5",
    quantity: "1.5",
    cva: "0.1",
    lf: "0.2",
    partyAmm: "0.3",
    partyBmm: "0",
  };
  return { ...base, ...overrides };
}

describe("lifecycleFromQuoteStatus", () => {
  /**
   * Every one of the 11 on-chain QuoteStatus members must map to a deterministic
   * lifecycle. Close-pending states surface as CLOSING, terminal-success states as
   * CLOSED, liquidation as FAILED, and all open/pending states fall through to the
   * ONCHAIN default.
   */
  const cases: ReadonlyArray<[QuoteStatus, QuoteLifecycle]> = [
    [QuoteStatus.PENDING, QuoteLifecycle.ONCHAIN],
    [QuoteStatus.LOCKED, QuoteLifecycle.ONCHAIN],
    [QuoteStatus.CANCEL_PENDING, QuoteLifecycle.ONCHAIN],
    [QuoteStatus.OPENED, QuoteLifecycle.ONCHAIN],
    [QuoteStatus.LIQUIDATED_PENDING, QuoteLifecycle.ONCHAIN],
    [QuoteStatus.CLOSE_PENDING, QuoteLifecycle.CLOSING],
    [QuoteStatus.CANCEL_CLOSE_PENDING, QuoteLifecycle.CLOSING],
    [QuoteStatus.CLOSED, QuoteLifecycle.CLOSED],
    [QuoteStatus.CANCELED, QuoteLifecycle.CLOSED],
    [QuoteStatus.EXPIRED, QuoteLifecycle.CLOSED],
    [QuoteStatus.LIQUIDATED, QuoteLifecycle.FAILED],
  ];

  it.each(cases)("maps status %s to lifecycle %s", (status, expected) => {
    expect(lifecycleFromQuoteStatus(status)).toBe(expected);
  });

  it("covers all 11 QuoteStatus members exactly once", () => {
    /** Guards against a new on-chain status slipping through unmapped. */
    const numericMembers = Object.values(QuoteStatus).filter((v): v is QuoteStatus => typeof v === "number");
    expect(numericMembers).toHaveLength(11);
    const covered = new Set(cases.map(([status]) => status));
    expect(covered.size).toBe(11);
  });
});

describe("toUnifiedQuoteFromOnchain", () => {
  it("keys, origins, and derives the CLOSING lifecycle from a partially-closed CLOSE_PENDING quote", () => {
    const quote = makeQuote();
    const row = toUnifiedQuoteFromOnchain(quote);
    expect(row.key).toBe("onchain:42");
    expect(row.origin).toBe("onchain");
    expect(row.lifecycle).toBe(QuoteLifecycle.CLOSING);
  });

  it("copies identity and market metadata straight through from the raw quote", () => {
    const quote = makeQuote();
    const row = toUnifiedQuoteFromOnchain(quote);
    expect(row.quoteId).toBe(quote.id);
    expect(row.partyA).toBe(quote.partyA);
    expect(row.partyB).toBe(quote.partyB);
    expect(row.symbolId).toBe(quote.symbolId);
    expect(row.positionType).toBe(quote.positionType);
    expect(row.orderType).toBe(quote.orderType);
    expect(row.quoteStatus).toBe(quote.quoteStatus);
  });

  it("copies prices including avgClosedPrice from the on-chain quote", () => {
    const quote = makeQuote();
    const row = toUnifiedQuoteFromOnchain(quote);
    expect(row.requestedOpenPrice).toBe(quote.requestedOpenPrice);
    expect(row.openedPrice).toBe(quote.openedPrice);
    expect(row.avgClosedPrice).toBe(quote.avgClosedPrice);
  });

  it("derives openQuantity as quantity − closedAmount (matching quoteOpenQuantity)", () => {
    const quote = makeQuote();
    const row = toUnifiedQuoteFromOnchain(quote);
    expect(row.openQuantity).toBe(quote.quantity - quote.closedAmount);
    expect(row.openQuantity).toBe(quoteOpenQuantity({ quantity: quote.quantity, closedAmount: quote.closedAmount }));
    expect(row.openQuantity).toBe(6_000000000000000000n);
  });

  it("carries amounts, locked values, and timestamps through untouched, and preserves the raw reference", () => {
    const quote = makeQuote();
    const row = toUnifiedQuoteFromOnchain(quote);
    expect(row.quantity).toBe(quote.quantity);
    expect(row.closedAmount).toBe(quote.closedAmount);
    expect(row.quantityToClose).toBe(quote.quantityToClose);
    expect(row.lockedValues).toBe(quote.lockedValues);
    expect(row.createTimestamp).toBe(quote.createTimestamp);
    expect(row.statusModifyTimestamp).toBe(quote.statusModifyTimestamp);
    /** raw.onchain must be the same object reference, not a copy. */
    expect(row.raw.onchain).toBe(quote);
  });

  it("derives ONCHAIN lifecycle for an OPENED quote", () => {
    const row = toUnifiedQuoteFromOnchain(makeQuote({ quoteStatus: QuoteStatus.OPENED }));
    expect(row.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });
});

describe("toUnifiedQuoteFromInstantOpen", () => {
  it("keys by temp id, marks the row offchain/OPTIMISTIC, and copies the temp id", () => {
    const pending = makePendingInstantOpen();
    const row = toUnifiedQuoteFromInstantOpen(pending);
    expect(row.key).toBe("temp:99");
    expect(row.origin).toBe("offchain");
    expect(row.lifecycle).toBe(QuoteLifecycle.OPTIMISTIC);
    expect(row.tempQuoteId).toBe(pending.tempQuoteId);
  });

  it("widens marketId into a bigint symbolId and copies the side/order metadata", () => {
    const pending = makePendingInstantOpen();
    const row = toUnifiedQuoteFromInstantOpen(pending);
    expect(row.symbolId).toBe(BigInt(pending.marketId));
    expect(row.partyA).toBe(pending.partyA);
    expect(row.positionType).toBe(PositionType.SHORT);
    expect(row.orderType).toBe(OrderType.LIMIT);
  });

  it("normalizes human-decimal price/quantity/locked legs to 18-decimal wei", () => {
    const pending = makePendingInstantOpen();
    const row = toUnifiedQuoteFromInstantOpen(pending);
    /** "2.5" → 2.5e18, "1.5" → 1.5e18, exercising toWeiBigInt's wei scaling. */
    expect(row.requestedOpenPrice).toBe(2_500000000000000000n);
    expect(row.quantity).toBe(1_500000000000000000n);
    /** openQuantity equals the wei quantity for a fresh optimistic open. */
    expect(row.openQuantity).toBe(1_500000000000000000n);
    expect(row.lockedValues.cva).toBe(100000000000000000n);
    expect(row.lockedValues.lf).toBe(200000000000000000n);
    expect(row.lockedValues.partyAmm).toBe(300000000000000000n);
    expect(row.lockedValues.partyBmm).toBe(0n);
  });

  it("leaves on-chain-only fields absent and preserves the raw record", () => {
    const pending = makePendingInstantOpen();
    const row = toUnifiedQuoteFromInstantOpen(pending);
    expect(row.quoteId).toBeUndefined();
    expect(row.openedPrice).toBeUndefined();
    expect(row.raw.instantOpen).toBe(pending);
  });
});

describe("toUnifiedQuoteFromInstantClose", () => {
  /** A normalized close record carries only the quote id and wei close amounts. */
  const pending: PendingInstantClose = {
    quoteId: 55n,
    quantityToClose: 3_000000000000000000n,
    closePrice: 2_100000000000000000n,
  };
  const context = {
    partyA: PARTY_A,
    symbolId: 7n,
    positionType: PositionType.SHORT,
    orderType: OrderType.LIMIT,
  };

  it("keys by quote id, marks the row onchain/CLOSING, and copies the quote id", () => {
    const row = toUnifiedQuoteFromInstantClose(pending, context);
    expect(row.key).toBe("onchain:55");
    expect(row.origin).toBe("onchain");
    expect(row.lifecycle).toBe(QuoteLifecycle.CLOSING);
    expect(row.quoteId).toBe(pending.quoteId);
  });

  it("takes market/side metadata from the context, not the close record", () => {
    const row = toUnifiedQuoteFromInstantClose(pending, context);
    expect(row.partyA).toBe(context.partyA);
    expect(row.symbolId).toBe(context.symbolId);
    expect(row.positionType).toBe(context.positionType);
    expect(row.orderType).toBe(context.orderType);
  });

  it("carries quantityToClose from the record and zeroes the open-side fields", () => {
    const row = toUnifiedQuoteFromInstantClose(pending, context);
    expect(row.quantityToClose).toBe(pending.quantityToClose);
    expect(row.requestedOpenPrice).toBe(0n);
    expect(row.quantity).toBe(0n);
    expect(row.openQuantity).toBe(0n);
    expect(row.lockedValues).toEqual({ cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n });
  });

  it("preserves the raw close record reference", () => {
    const row = toUnifiedQuoteFromInstantClose(pending, context);
    expect(row.raw.instantClose).toBe(pending);
  });
});
