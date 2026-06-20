import {
  OrderType,
  PositionType,
  QuoteLifecycle,
  QuoteStatus,
  SubAccountIsolationType,
  type UnifiedQuote,
} from "@symm-frontier/core";
import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Mock the underlying reads so the test exercises only the partition + grouping fold. */
const { useManagedQuotesMock } = vi.hoisted(() => ({ useManagedQuotesMock: vi.fn() }));
vi.mock("./use-managed-quotes", () => ({ useManagedQuotes: useManagedQuotesMock }));

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
  beforeEach(() => useManagedQuotesMock.mockReset());

  it("groups active positions by MARKET_DIRECTION and keeps pending orders flat", () => {
    mockManaged([ethLong, ethShort, ethLimit]);
    const { result } = renderHook(() => useGroupedQuotes({ partyA: PARTY_A }));

    expect(result.current.groups).toHaveLength(2); // ETH long + ETH short
    expect(result.current.pending.map((q) => q.key)).toEqual(["onchain:3"]);
    expect(result.current.quotes).toHaveLength(3); // flat list passes through
  });

  it("respects a non-default strategy", () => {
    mockManaged([ethLong, ethShort, ethLimit]);
    const { result } = renderHook(() =>
      useGroupedQuotes({ partyA: PARTY_A, strategy: SubAccountIsolationType.MARKET }),
    );

    // MARKET collapses both sides into one group
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]!.key).toBe("m:1");
  });

  it("forwards managed-quotes parameters without leaking the grouping options", () => {
    mockManaged([]);
    renderHook(() =>
      useGroupedQuotes({ partyA: PARTY_A, chainId: 1, strategy: SubAccountIsolationType.MARKET, groupSort: () => 0 }),
    );

    expect(useManagedQuotesMock).toHaveBeenCalledWith({ partyA: PARTY_A, chainId: 1 });
  });

  it("passes the managed result fields through", () => {
    mockManaged([ethLong]);
    const { result } = renderHook(() => useGroupedQuotes({ partyA: PARTY_A }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.accounts).toEqual([PARTY_A]);
    expect(result.current.socketStatus).toBe("closed");
  });
});
