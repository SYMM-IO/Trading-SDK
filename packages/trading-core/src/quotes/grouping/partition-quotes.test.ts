import { describe, expect, it } from "vitest";
import { OrderType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import { QuoteLifecycle } from "../unified-quote";
import { makeOptimisticQuote, makeUnifiedQuote } from "../unified-quote.test";
import { isActivePosition, isPendingOrder, partitionQuotes } from "./partition-quotes";

describe("isPendingOrder / isActivePosition (on-chain)", () => {
  it.each([QuoteStatus.PENDING, QuoteStatus.LOCKED, QuoteStatus.CANCEL_PENDING])(
    "classifies status %s as a pending order",
    (quoteStatus) => {
      const quote = makeUnifiedQuote({ quoteStatus });
      expect(isPendingOrder(quote)).toBe(true);
      expect(isActivePosition(quote)).toBe(false);
    },
  );

  it.each([
    QuoteStatus.OPENED,
    QuoteStatus.CLOSE_PENDING,
    QuoteStatus.CANCEL_CLOSE_PENDING,
    QuoteStatus.LIQUIDATED_PENDING,
  ])("classifies status %s as an active position", (quoteStatus) => {
    const quote = makeUnifiedQuote({ quoteStatus });
    expect(isActivePosition(quote)).toBe(true);
    expect(isPendingOrder(quote)).toBe(false);
  });

  it.each([QuoteStatus.CLOSED, QuoteStatus.CANCELED, QuoteStatus.EXPIRED, QuoteStatus.LIQUIDATED])(
    "classifies terminal status %s as neither",
    (quoteStatus) => {
      const quote = makeUnifiedQuote({ quoteStatus });
      expect(isActivePosition(quote)).toBe(false);
      expect(isPendingOrder(quote)).toBe(false);
    },
  );
});

describe("isPendingOrder / isActivePosition (off-chain, no status yet)", () => {
  it("treats an optimistic MARKET open as an active position", () => {
    const quote = makeOptimisticQuote({ orderType: OrderType.MARKET });
    expect(isActivePosition(quote)).toBe(true);
    expect(isPendingOrder(quote)).toBe(false);
  });

  it("treats an optimistic LIMIT open as a pending order", () => {
    const quote = makeOptimisticQuote({ orderType: OrderType.LIMIT });
    expect(isPendingOrder(quote)).toBe(true);
    expect(isActivePosition(quote)).toBe(false);
  });

  it("treats an in-flight close row (WRITE_ONCHAIN_CLOSE) as an active position", () => {
    const quote = makeUnifiedQuote({
      origin: "offchain",
      lifecycle: QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
      quoteStatus: undefined,
    });
    expect(isActivePosition(quote)).toBe(true);
    expect(isPendingOrder(quote)).toBe(false);
  });

  it("treats an off-chain FAILED row as neither", () => {
    const quote = makeUnifiedQuote({ origin: "offchain", lifecycle: QuoteLifecycle.FAILED, quoteStatus: undefined });
    expect(isActivePosition(quote)).toBe(false);
    expect(isPendingOrder(quote)).toBe(false);
  });

  it("keeps a notification-anchored MARKET row (ONCHAIN, no quoteStatus yet) as an active position", () => {
    // the SendQuoteTransaction window: lifecycle is ONCHAIN but the poll hasn't returned quoteStatus
    const quote = makeUnifiedQuote({
      lifecycle: QuoteLifecycle.ONCHAIN,
      quoteStatus: undefined,
      orderType: OrderType.MARKET,
    });
    expect(isActivePosition(quote)).toBe(true);
    expect(isPendingOrder(quote)).toBe(false);
  });

  it("treats a just-anchored LIMIT row (ONCHAIN, no quoteStatus yet) as a pending order", () => {
    const quote = makeUnifiedQuote({
      lifecycle: QuoteLifecycle.ONCHAIN,
      quoteStatus: undefined,
      orderType: OrderType.LIMIT,
    });
    expect(isPendingOrder(quote)).toBe(true);
    expect(isActivePosition(quote)).toBe(false);
  });

  it("treats a WRITE_ONCHAIN MARKET row (anchored, awaiting RPC) as an active position", () => {
    const quote = makeUnifiedQuote({
      lifecycle: QuoteLifecycle.WRITE_ONCHAIN,
      quoteStatus: undefined,
      orderType: OrderType.MARKET,
    });
    expect(isActivePosition(quote)).toBe(true);
    expect(isPendingOrder(quote)).toBe(false);
  });

  it("treats a WRITE_ONCHAIN LIMIT row (anchored, awaiting RPC) as a pending order", () => {
    const quote = makeUnifiedQuote({
      lifecycle: QuoteLifecycle.WRITE_ONCHAIN,
      quoteStatus: undefined,
      orderType: OrderType.LIMIT,
    });
    expect(isPendingOrder(quote)).toBe(true);
    expect(isActivePosition(quote)).toBe(false);
  });

  it("treats a WRITE_ONCHAIN_CLOSE row (close requested, awaiting RPC) as an active position", () => {
    const quote = makeUnifiedQuote({ lifecycle: QuoteLifecycle.WRITE_ONCHAIN_CLOSE, quoteStatus: undefined });
    expect(isActivePosition(quote)).toBe(true);
    expect(isPendingOrder(quote)).toBe(false);
  });

  it.each([QuoteLifecycle.OPTIMISTIC_CLOSE, QuoteLifecycle.CLOSE_PRICE_FILLED])(
    "treats an in-flight close stage %s as an active position",
    (lifecycle) => {
      const quote = makeUnifiedQuote({ lifecycle, quoteStatus: undefined });
      expect(isActivePosition(quote)).toBe(true);
      expect(isPendingOrder(quote)).toBe(false);
    },
  );
});

describe("partitionQuotes", () => {
  it("splits into positions and pending, drops terminal rows, preserves order", () => {
    const opened = makeUnifiedQuote({ key: "onchain:1", quoteStatus: QuoteStatus.OPENED });
    const pending = makeUnifiedQuote({ key: "onchain:2", quoteStatus: QuoteStatus.PENDING });
    const closed = makeUnifiedQuote({ key: "onchain:3", quoteStatus: QuoteStatus.CLOSED });
    const closing = makeUnifiedQuote({ key: "onchain:4", quoteStatus: QuoteStatus.CLOSE_PENDING });

    const { positions, pending: pendingOrders } = partitionQuotes([opened, pending, closed, closing]);

    expect(positions.map((q) => q.key)).toEqual(["onchain:1", "onchain:4"]);
    expect(pendingOrders.map((q) => q.key)).toEqual(["onchain:2"]);
  });

  it("returns empty buckets for empty input", () => {
    expect(partitionQuotes([])).toEqual({ positions: [], pending: [] });
  });
});
