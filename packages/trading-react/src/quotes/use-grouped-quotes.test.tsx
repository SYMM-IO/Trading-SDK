import {
  OrderType,
  PositionType,
  QuoteLifecycle,
  QuoteStatus,
  SubAccountIsolationType,
  keyQuoteByMarket,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mock the underlying reads so the test exercises only the partition + grouping fold. */
const { useManagedQuotesMock, useGroupingIsolationMock } = vi.hoisted(() => ({
  useManagedQuotesMock: vi.fn(),
  useGroupingIsolationMock: vi.fn(),
}));
vi.mock("./use-managed-quotes", () => ({ useManagedQuotes: useManagedQuotesMock }));
vi.mock("./use-grouping-isolation", () => ({ useGroupingIsolation: useGroupingIsolationMock }));

import { useGroupedQuotes } from "./use-grouped-quotes";

const PARTY_A: Address = "0x1111111111111111111111111111111111111111";
const VA: Address = "0x2222222222222222222222222222222222222222";

function quote(overrides: Partial<UnifiedQuote>): UnifiedQuote {
  const base: UnifiedQuote = {
    key: "onchain:1",
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 1n,
    partyA: PARTY_A,
    vaAddress: VA,
    symbolId: 1n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    quoteStatus: QuoteStatus.OPENED,
    requestedOpenPrice: 100_000000000000000000n,
    openedPrice: 100_000000000000000000n,
    quantity: 1_000000000000000000n,
    openQuantity: 1_000000000000000000n,
    lockedValues: { cva: 5_000000000000000000n, lf: 0n, partyAmm: 5_000000000000000000n, partyBmm: 0n },
    statusModifyTimestamp: 1_000n,
    raw: {},
  };
  return { ...base, ...overrides };
}

function mockManaged(quotes: UnifiedQuote[]) {
  useManagedQuotesMock.mockReturnValue({
    quotes,
    byKey: Object.fromEntries(quotes.map((q) => [q.key, q])),
    accounts: [PARTY_A],
    isLoading: false,
    isFetching: false,
    socketStatus: "closed",
    error: null,
    refetch: vi.fn(),
  });
}

const ethLong = quote({ key: "onchain:1", symbolId: 1n, positionType: PositionType.LONG });
const ethShort = quote({ key: "onchain:2", symbolId: 1n, positionType: PositionType.SHORT });
const ethLimit = quote({
  key: "onchain:3",
  symbolId: 1n,
  orderType: OrderType.LIMIT,
  quoteStatus: QuoteStatus.PENDING,
  lifecycle: QuoteLifecycle.ONCHAIN,
});

describe("useGroupedQuotes", () => {
  beforeEach(() => {
    useManagedQuotesMock.mockReset();
    useGroupingIsolationMock.mockReset();
    useGroupingIsolationMock.mockReturnValue(SubAccountIsolationType.MARKET_DIRECTION);
  });
  afterEach(() => vi.restoreAllMocks());

  it("groups active positions by MARKET_DIRECTION and keeps pending orders flat", () => {
    mockManaged([ethLong, ethShort, ethLimit]);
    const { result } = renderHook(() => useGroupedQuotes({ partyA: PARTY_A }));

    expect(result.current.groups).toHaveLength(2); // ETH long + ETH short
    expect(result.current.pending.map((q) => q.key)).toEqual(["onchain:3"]);
    expect(result.current.quotes).toHaveLength(3); // flat list passes through
    expect(result.current.isGroupingSupported).toBe(true);
    expect(result.current.groupingError).toBeNull();
    expect(result.current.isolationType).toBe(SubAccountIsolationType.MARKET_DIRECTION);
  });

  it("groups while the sub-account isolation is still unresolved", () => {
    mockManaged([ethLong, ethShort]);
    useGroupingIsolationMock.mockReturnValue(undefined);
    const { result } = renderHook(() => useGroupedQuotes({ partyA: PARTY_A }));

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.isGroupingSupported).toBe(true);
    expect(result.current.isolationType).toBeUndefined();
  });

  it.each([SubAccountIsolationType.MARKET, SubAccountIsolationType.POSITION, SubAccountIsolationType.CUSTOM])(
    "returns no groups when the sub-account isolation is %s",
    (isolation) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockManaged([ethLong, ethShort, ethLimit]);
      useGroupingIsolationMock.mockReturnValue(isolation);
      const { result } = renderHook(() => useGroupedQuotes({ partyA: PARTY_A }));

      expect(result.current.groups).toEqual([]);
      expect(result.current.isGroupingSupported).toBe(false);
      expect(result.current.isolationType).toBe(isolation);
      expect(result.current.groupingError).toMatchObject({ code: "UNSUPPORTED_GROUPING_ISOLATION" });
      // the flat views stay usable
      expect(result.current.quotes).toHaveLength(3);
      expect(result.current.pending.map((q) => q.key)).toEqual(["onchain:3"]);
      expect(warn).toHaveBeenCalledOnce();
    },
  );

  it("throws when the caller passes an unsupported isolation type as the strategy", () => {
    mockManaged([ethLong]);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      renderHook(() => useGroupedQuotes({ partyA: PARTY_A, strategy: SubAccountIsolationType.MARKET })),
    ).toThrow(expect.objectContaining({ code: "UNSUPPORTED_GROUPING_ISOLATION" }));
    error.mockRestore();
  });

  it("accepts a custom keyOf and skips the isolation lookup", () => {
    mockManaged([ethLong, ethShort, ethLimit]);
    useGroupingIsolationMock.mockReturnValue(undefined);
    const strategy = { keyOf: keyQuoteByMarket };
    const { result } = renderHook(() => useGroupedQuotes({ partyA: PARTY_A, strategy }));

    // keyQuoteByMarket collapses both sides into one group
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]!.key).toBe("m:1");
    expect(useGroupingIsolationMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("forwards managed-quotes parameters without leaking the grouping options", () => {
    mockManaged([]);
    renderHook(() => useGroupedQuotes({ partyA: PARTY_A, chainId: 1, groupSort: () => 0 }));

    expect(useManagedQuotesMock).toHaveBeenCalledWith({ partyA: PARTY_A, chainId: 1 });
    expect(useGroupingIsolationMock).toHaveBeenCalledWith({ account: PARTY_A, chainId: 1, enabled: true });
  });

  it("passes the managed result fields through", () => {
    mockManaged([ethLong]);
    const { result } = renderHook(() => useGroupedQuotes({ partyA: PARTY_A }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.accounts).toEqual([PARTY_A]);
    expect(result.current.socketStatus).toBe("closed");
  });
});
