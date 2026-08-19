import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { PendingInstantClose } from "../solvers/instant-close/get-instant-closes/to-pending-instant-close";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/types";
import { OrderType, PositionType, QuoteStatus, type LockedValues, type Quote } from "../symmio-contracts/symmio/types";
import { NotificationType, type Notification } from "../websocket/notifications/types";
import { reconcileQuotes } from "./reconcile-quotes";
import { QuoteLifecycle } from "./unified-quote";

/** Deterministic sub-account (partyA) the snapshot belongs to. */
const PARTY_A = "0x000000000000000000000000000000000000a11a" as Address;
/** Deterministic partyB (hedger). */
const PARTY_B = "0x000000000000000000000000000000000000b22b" as Address;
/** A Virtual Account address distinct from PARTY_A (VA-scoped reads carry this as partyA). */
const TEST_VA = "0x000000000000000000000000000000000000Va00" as Address;

/** All-zero locked legs; individual cases override cva/lf when they need a fingerprint. */
const ZERO_LOCKED: LockedValues = { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n };

/**
 * Build a full raw on-chain {@link Quote}. The reconcile engine consumes the raw
 * contract struct (not a UnifiedQuote), so we hand-build it here. Defaults to an
 * `OPENED` long market position owned by {@link PARTY_A}.
 */
function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 1n,
    partyBsWhiteList: [],
    symbolId: 1n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    openedPrice: 2_000000000000000000n,
    initialOpenedPrice: 2_000000000000000000n,
    requestedOpenPrice: 2_000000000000000000n,
    marketPrice: 2_000000000000000000n,
    quantity: 5_000000000000000000n,
    closedAmount: 0n,
    initialLockedValues: ZERO_LOCKED,
    lockedValues: ZERO_LOCKED,
    maxFundingRate: 0n,
    partyA: PARTY_A,
    partyB: PARTY_B,
    quoteStatus: QuoteStatus.OPENED,
    avgClosedPrice: 0n,
    requestedClosePrice: 0n,
    quantityToClose: 0n,
    parentId: 0n,
    createTimestamp: 1_000n,
    statusModifyTimestamp: 1_000n,
    lastFundingPaymentTimestamp: 0n,
    deadline: 0n,
    tradingFee: 0n,
    affiliate: "0x0000000000000000000000000000000000000000",
    accumulatedPaidFunding: 0n,
    closeFee: 0n,
    data: "0x",
    ...overrides,
  };
}

/**
 * Build a {@link PendingInstantOpen} (hedger record) with human-scaled decimal
 * strings — the engine normalizes these to wei via `toUnifiedQuoteFromInstantOpen`.
 */
function makePendingOpen(overrides: Partial<PendingInstantOpen> = {}): PendingInstantOpen {
  return {
    kind: "enigma",
    uuid: "",
    tempQuoteId: 7,
    marketId: 1,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    partyA: PARTY_A,
    requestedOpenPrice: "2",
    quantity: "5",
    cva: "0",
    lf: "0",
    partyAmm: "0",
    partyBmm: "0",
    ...overrides,
  };
}

/** Build a {@link PendingInstantClose} (hedger record) with wei bigints. */
function makePendingClose(overrides: Partial<PendingInstantClose> = {}): PendingInstantClose {
  return {
    quoteId: 1n,
    quantityToClose: 3_000000000000000000n,
    closePrice: 2_000000000000000000n,
    ...overrides,
  };
}

/**
 * Build a normalized {@link Notification}, modeled on the apply-notification
 * fixtures. Defaults to a SEEN no-op so individual cases opt into a concrete
 * action/type. The on-chain id is taken from `quoteId` and differs from
 * `tempQuoteId` so the engine rekeys a temp row onto `onchain:<quoteId>`.
 */
function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    quoteId: "0",
    tempQuoteId: 0,
    type: NotificationType.SEEN,
    actionStatus: "seen",
    lastSeenAction: null,
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

/** Empty-source shorthand so each case only supplies the sources it exercises. */
function emptyInput() {
  return {
    partyA: PARTY_A,
    onchainPositions: [] as Quote[],
    onchainPendingQuotes: [] as Quote[],
    instantOpens: [] as PendingInstantOpen[],
    instantCloses: [] as PendingInstantClose[],
  };
}

describe("reconcileQuotes — on-chain anchoring", () => {
  it("turns an on-chain position into an anchored row keyed onchain:<id> with origin onchain", () => {
    const { quotes } = reconcileQuotes({ ...emptyInput(), onchainPositions: [makeQuote({ id: 42n })] });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.key).toBe("onchain:42");
    expect(quotes[0]?.origin).toBe("onchain");
    expect(quotes[0]?.quoteId).toBe(42n);
  });

  it("does not re-add a pending quote whose key already came from a position — the position wins", () => {
    /**
     * Same id in both sources: positions are inserted first unconditionally,
     * pending quotes only fill gaps. Prove the kept row carries the position's
     * data (OPENED), not the pending quote's (PENDING).
     */
    const position = makeQuote({ id: 9n, quoteStatus: QuoteStatus.OPENED, quantity: 5_000000000000000000n });
    const pending = makeQuote({ id: 9n, quoteStatus: QuoteStatus.PENDING, quantity: 99_000000000000000000n });
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [position],
      onchainPendingQuotes: [pending],
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.quoteStatus).toBe(QuoteStatus.OPENED);
    expect(quotes[0]?.quantity).toBe(5_000000000000000000n);
  });

  it("adds a pending quote when its key is not already present", () => {
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [makeQuote({ id: 1n })],
      onchainPendingQuotes: [makeQuote({ id: 2n, quoteStatus: QuoteStatus.PENDING })],
    });
    expect(quotes.map((q) => q.key).sort()).toEqual(["onchain:1", "onchain:2"]);
  });
});

describe("reconcileQuotes — withVaAddress", () => {
  it("leaves vaAddress undefined when the position's partyA equals the sub-account, case-insensitively", () => {
    /**
     * The compare lowercases both sides. Pass partyA as a checksum/mixed-case form
     * of PARTY_A so the row is only recognized as same-account via the
     * case-insensitive compare — a case-sensitive compare would wrongly stamp a VA.
     */
    const mixedCasePartyA = "0x000000000000000000000000000000000000A11A" as Address;
    const { quotes } = reconcileQuotes({ ...emptyInput(), onchainPositions: [makeQuote({ partyA: mixedCasePartyA })] });
    expect(quotes[0]?.vaAddress).toBeUndefined();
  });

  it("stamps vaAddress from partyA when it differs (a VA-scoped read), preserving its original case", () => {
    /**
     * The position is read under a VA, so its partyA IS the VA address. When it
     * differs from the sub-account, the original-cased partyA is surfaced on
     * vaAddress unchanged (TEST_VA carries mixed case to prove no normalization).
     */
    const { quotes } = reconcileQuotes({ ...emptyInput(), onchainPositions: [makeQuote({ partyA: TEST_VA })] });
    expect(quotes[0]?.vaAddress).toBe(TEST_VA);
  });
});

describe("reconcileQuotes — instant-close overlay", () => {
  it("overlays a close on an OPENED row as OPTIMISTIC_CLOSE (in-flight, on-chain still open)", () => {
    const close = makePendingClose({ quoteId: 5n, quantityToClose: 3_000000000000000000n });
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [makeQuote({ id: 5n, quoteStatus: QuoteStatus.OPENED })],
      instantCloses: [close],
    });
    expect(quotes[0]?.lifecycle).toBe(QuoteLifecycle.OPTIMISTIC_CLOSE);
    expect(quotes[0]?.quantityToClose).toBe(3_000000000000000000n);
    expect(quotes[0]?.raw.instantClose).toBe(close);
  });

  it("advances an overlaid close to WRITE_ONCHAIN_CLOSE from the fill notification", () => {
    const fill = makeNotification({
      quoteId: "5",
      type: NotificationType.SUCCESS,
      actionStatus: "success",
      lastSeenAction: "FillMarketOrderInstantClose",
    });
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [makeQuote({ id: 5n, quoteStatus: QuoteStatus.OPENED })],
      instantCloses: [makePendingClose({ quoteId: 5n })],
      notifications: [fill],
    });
    expect(quotes[0]?.lifecycle).toBe(QuoteLifecycle.WRITE_ONCHAIN_CLOSE);
  });

  it("keeps a close overlay on a CLOSE_PENDING row at ONCHAIN (on-chain already reflects the close, don't regress)", () => {
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [makeQuote({ id: 5n, quoteStatus: QuoteStatus.CLOSE_PENDING })],
      instantCloses: [makePendingClose({ quoteId: 5n })],
    });
    expect(quotes[0]?.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });

  it("drops a terminal (CLOSED) quote — a done quote a lagging read still lists is not active", () => {
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [makeQuote({ id: 5n, quoteStatus: QuoteStatus.CLOSED })],
      instantCloses: [makePendingClose({ quoteId: 5n })],
    });
    expect(quotes).toHaveLength(0);
  });

  it("skips a close with no matching on-chain row (no synthetic placeholder appears)", () => {
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [makeQuote({ id: 1n })],
      instantCloses: [makePendingClose({ quoteId: 999n })],
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.key).toBe("onchain:1");
  });
});

describe("reconcileQuotes — instant-open optimistic rows", () => {
  it("adds an optimistic row keyed temp:<id> with OPTIMISTIC lifecycle", () => {
    const { quotes } = reconcileQuotes({ ...emptyInput(), instantOpens: [makePendingOpen({ tempQuoteId: 7 })] });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.key).toBe("temp:7");
    expect(quotes[0]?.lifecycle).toBe(QuoteLifecycle.OPTIMISTIC);
    expect(quotes[0]?.tempQuoteId).toBe(7);
  });

  it("drops the optimistic row when an on-chain row already carries the same fingerprint (trade landed)", () => {
    /**
     * The fingerprint is orderType:positionType:cva:lf:quantity:requestedOpenPrice.
     * Match the on-chain wei values to the pending open's normalized decimals
     * ("5" → 5e18, "2" → 2e18, cva "10" → 10e18, lf "3" → 3e18) so the engine
     * recognizes the optimistic row as the same trade and drops it.
     */
    const landed = makeQuote({
      id: 10n,
      orderType: OrderType.MARKET,
      positionType: PositionType.LONG,
      quantity: 5_000000000000000000n,
      requestedOpenPrice: 2_000000000000000000n,
      lockedValues: { cva: 10_000000000000000000n, lf: 3_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    });
    const open = makePendingOpen({
      tempQuoteId: 7,
      orderType: OrderType.MARKET,
      positionType: PositionType.LONG,
      quantity: "5",
      requestedOpenPrice: "2",
      cva: "10",
      lf: "3",
    });
    const { quotes } = reconcileQuotes({ ...emptyInput(), onchainPositions: [landed], instantOpens: [open] });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.key).toBe("onchain:10");
  });

  it("keeps the optimistic row when no on-chain fingerprint matches", () => {
    const landed = makeQuote({ id: 10n, quantity: 5_000000000000000000n });
    const open = makePendingOpen({ tempQuoteId: 7, quantity: "999" });
    const { quotes } = reconcileQuotes({ ...emptyInput(), onchainPositions: [landed], instantOpens: [open] });
    expect(quotes.map((q) => q.key).sort()).toEqual(["onchain:10", "temp:7"]);
  });

  it("stamps the optimistic row's vaAddress from instantOpenVaByTempId for the matching tempQuoteId", () => {
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      instantOpens: [makePendingOpen({ tempQuoteId: 7 })],
      instantOpenVaByTempId: { 7: TEST_VA },
    });
    expect(quotes[0]?.vaAddress).toBe(TEST_VA);
  });
});

describe("reconcileQuotes — notifications", () => {
  it("rekeys an optimistic temp row to onchain:<id> and sets WRITE_ONCHAIN until the read confirms", () => {
    /**
     * SendQuoteTransaction success is an open-anchor action: it links the on-chain
     * id onto the temp row and rekeys temp:7 → onchain:55. The on-chain struct has
     * not been read yet (`raw.onchain` absent), so the row sits at WRITE_ONCHAIN and
     * is surfaced as a `pendingAnchor` for the next tick. quoteId differs from
     * tempQuoteId so the engine treats it as anchored.
     */
    const open = makePendingOpen({ tempQuoteId: 7 });
    const notification = makeNotification({
      quoteId: "55",
      tempQuoteId: 7,
      type: NotificationType.SUCCESS,
      actionStatus: "success",
      lastSeenAction: "SendQuoteTransaction",
    });
    const { quotes, pendingAnchors } = reconcileQuotes({
      ...emptyInput(),
      instantOpens: [open],
      notifications: [notification],
    });
    expect(quotes[0]?.key).toBe("onchain:55");
    expect(quotes[0]?.quoteId).toBe(55n);
    expect(quotes[0]?.lifecycle).toBe(QuoteLifecycle.WRITE_ONCHAIN);
    expect(pendingAnchors.map((row) => row.key)).toEqual(["onchain:55"]);
  });

  it("applies notifications in arrival order (a later FAILED overrides an earlier anchor)", () => {
    const open = makePendingOpen({ tempQuoteId: 7 });
    const anchor = makeNotification({
      quoteId: "55",
      tempQuoteId: 7,
      type: NotificationType.SUCCESS,
      actionStatus: "success",
      lastSeenAction: "SendQuoteTransaction",
    });
    const fail = makeNotification({
      quoteId: "55",
      tempQuoteId: 7,
      type: NotificationType.FAILED,
      actionStatus: "failed",
    });
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      instantOpens: [open],
      notifications: [anchor, fail],
    });
    expect(quotes[0]?.lifecycle).toBe(QuoteLifecycle.FAILED);
  });
});

describe("reconcileQuotes — collapseByKey", () => {
  it("merges a rekeyed optimistic row onto its on-chain twin: no duplicate key, on-chain wins, temp ids grafted", () => {
    /**
     * The poll already returned onchain:55 while the hedger still reports temp:7
     * with a NON-matching fingerprint (so it is not dropped by the fingerprint
     * rule). A SendQuoteTransaction notification rekeys temp:7 → onchain:55, so two
     * rows now share the key. collapseByKey keeps the on-chain row (raw.onchain)
     * and grafts tempQuoteId + raw.instantOpen from the optimistic survivor.
     */
    const polled = makeQuote({ id: 55n, quantity: 5_000000000000000000n });
    const open = makePendingOpen({ tempQuoteId: 7, quantity: "999" });
    const notification = makeNotification({
      quoteId: "55",
      tempQuoteId: 7,
      type: NotificationType.SUCCESS,
      actionStatus: "success",
      lastSeenAction: "SendQuoteTransaction",
    });
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [polled],
      instantOpens: [open],
      notifications: [notification],
    });
    const onchain55 = quotes.filter((q) => q.key === "onchain:55");
    expect(onchain55).toHaveLength(1);
    expect(onchain55[0]?.raw.onchain).toBe(polled);
    expect(onchain55[0]?.tempQuoteId).toBe(7);
    expect(onchain55[0]?.raw.instantOpen).toBe(open);
    // The polled struct is present, so the anchor settles to ONCHAIN (not WRITE_ONCHAIN).
    expect(onchain55[0]?.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
  });
});

describe("reconcileQuotes — write-onchain retention", () => {
  /** Produce a single WRITE_ONCHAIN row (anchored per notification, no on-chain struct yet). */
  function makeWriteOnchainTick() {
    const open = makePendingOpen({ tempQuoteId: 7 });
    const anchor = makeNotification({
      quoteId: "55",
      tempQuoteId: 7,
      type: NotificationType.SUCCESS,
      actionStatus: "success",
      lastSeenAction: "SendQuoteTransaction",
    });
    return reconcileQuotes({ ...emptyInput(), instantOpens: [open], notifications: [anchor] });
  }

  it("retains an anchored-but-unread row via retainedAnchors when no live source holds it", () => {
    const first = makeWriteOnchainTick();
    expect(first.pendingAnchors).toHaveLength(1);
    /**
     * Next tick: the hedger has dropped the pending open and the on-chain read has
     * not returned the quote yet. Without retention the row would vanish; feeding
     * the prior `pendingAnchors` back keeps it as WRITE_ONCHAIN.
     */
    const second = reconcileQuotes({ ...emptyInput(), retainedAnchors: first.pendingAnchors });
    expect(second.quotes.map((q) => q.key)).toEqual(["onchain:55"]);
    expect(second.quotes[0]?.lifecycle).toBe(QuoteLifecycle.WRITE_ONCHAIN);
    expect(second.pendingAnchors).toHaveLength(1);
  });

  it("drops the retained anchor once the on-chain read returns the quote (settles to ONCHAIN)", () => {
    const first = makeWriteOnchainTick();
    const settled = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [makeQuote({ id: 55n, quoteStatus: QuoteStatus.OPENED })],
      retainedAnchors: first.pendingAnchors,
    });
    expect(settled.quotes).toHaveLength(1);
    expect(settled.quotes[0]?.key).toBe("onchain:55");
    expect(settled.quotes[0]?.lifecycle).toBe(QuoteLifecycle.ONCHAIN);
    expect(settled.quotes[0]?.raw.onchain).toBeDefined();
    expect(settled.pendingAnchors).toHaveLength(0);
  });
});

describe("reconcileQuotes — sort", () => {
  it("orders rows by statusModifyTimestamp descending (newest first)", () => {
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [
        makeQuote({ id: 1n, statusModifyTimestamp: 100n }),
        makeQuote({ id: 2n, statusModifyTimestamp: 300n }),
        makeQuote({ id: 3n, statusModifyTimestamp: 200n }),
      ],
    });
    expect(quotes.map((q) => q.quoteId)).toEqual([2n, 3n, 1n]);
  });

  it("breaks ties by stableSortKey — higher quoteId first when timestamps are equal", () => {
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      onchainPositions: [
        makeQuote({ id: 1n, statusModifyTimestamp: 500n }),
        makeQuote({ id: 9n, statusModifyTimestamp: 500n }),
        makeQuote({ id: 4n, statusModifyTimestamp: 500n }),
      ],
    });
    expect(quotes.map((q) => q.quoteId)).toEqual([9n, 4n, 1n]);
  });

  it("falls back to BigInt(tempQuoteId) for an unanchored temp row in a tie", () => {
    /**
     * Optimistic rows carry no statusModifyTimestamp, so both tie at 0n and the
     * tiebreak uses BigInt(tempQuoteId): temp 8 sorts before temp 3.
     */
    const { quotes } = reconcileQuotes({
      ...emptyInput(),
      instantOpens: [makePendingOpen({ tempQuoteId: 3 }), makePendingOpen({ tempQuoteId: 8 })],
    });
    expect(quotes.map((q) => q.tempQuoteId)).toEqual([8, 3]);
  });
});

describe("reconcileQuotes — links", () => {
  it("records tempQuoteId → key only once the row has anchored (quoteId present)", () => {
    const anchored = makePendingOpen({ tempQuoteId: 7 });
    const stillOptimistic = makePendingOpen({ tempQuoteId: 8 });
    const anchorNotification = makeNotification({
      quoteId: "55",
      tempQuoteId: 7,
      type: NotificationType.SUCCESS,
      actionStatus: "success",
      lastSeenAction: "SendQuoteTransaction",
    });
    const { links } = reconcileQuotes({
      ...emptyInput(),
      instantOpens: [anchored, stillOptimistic],
      notifications: [anchorNotification],
    });
    expect(links[7]).toBe("onchain:55");
    expect(links[8]).toBeUndefined();
  });
});

describe("reconcileQuotes — active only", () => {
  it("output length matches the union of sources; nothing lingers from a prior tick", () => {
    /**
     * Each source contributes a distinct row: two positions, one pending quote,
     * one optimistic open with no matching fingerprint. A close targeting a
     * present position overlays (does not add a row). Total = 4 distinct keys.
     */
    const { quotes } = reconcileQuotes({
      partyA: PARTY_A,
      onchainPositions: [makeQuote({ id: 1n }), makeQuote({ id: 2n })],
      onchainPendingQuotes: [makeQuote({ id: 3n, quoteStatus: QuoteStatus.PENDING })],
      instantOpens: [makePendingOpen({ tempQuoteId: 7, quantity: "12345" })],
      instantCloses: [makePendingClose({ quoteId: 1n })],
    });
    expect(quotes).toHaveLength(4);
    expect(quotes.map((q) => q.key).sort()).toEqual(["onchain:1", "onchain:2", "onchain:3", "temp:7"]);
  });
});
