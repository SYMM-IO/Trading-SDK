import {
  groupQuotes,
  OrderType,
  PositionType,
  QuoteLifecycle,
  QuoteStatus,
  SubAccountIsolationType,
  type QuoteFundingData,
  type QuoteGroup,
  type QuoteGroupFunding,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Both collaborators are mocked: the subgraph read (so no network) and core's
 * pure fold (so this test pins the delegation contract, while the arithmetic
 * stays covered by core's own `aggregate-group-funding.test.ts`).
 */
const { useQuotesFundingMock, aggregateGroupFundingMock } = vi.hoisted(() => ({
  useQuotesFundingMock: vi.fn(),
  aggregateGroupFundingMock: vi.fn(),
}));

vi.mock("./use-quotes-funding", () => ({ useQuotesFunding: useQuotesFundingMock }));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, aggregateGroupFunding: aggregateGroupFundingMock };
});

import { useQuoteGroupFunding } from "./use-quote-group-funding";

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

/** Build a real {@link QuoteGroup} through core's grouping fold, not by hand. */
function groupOf(quotes: UnifiedQuote[]): QuoteGroup {
  const groups = groupQuotes(quotes, SubAccountIsolationType.MARKET_DIRECTION);
  return groups[0]!;
}

const FIRST = quote({ key: "onchain:1", quoteId: 1n });
const SECOND = quote({ key: "onchain:2", quoteId: 2n });
const OPTIMISTIC = quote({ key: "optimistic:a", quoteId: undefined, lifecycle: QuoteLifecycle.OPTIMISTIC });

const FIRST_ROW: QuoteFundingData = {
  quoteId: 1n,
  paid: 30_000000000000000000n,
  received: 10_000000000000000000n,
  netReceived: -20_000000000000000000n,
};
const SECOND_ROW: QuoteFundingData = {
  quoteId: 2n,
  paid: 1_000000000000000000n,
  received: 4_000000000000000000n,
  netReceived: 3_000000000000000000n,
};

/** Sentinel the mocked core fold returns; identity is what the assertions check. */
const AGGREGATE: QuoteGroupFunding = {
  paid: 31_000000000000000000n,
  received: 14_000000000000000000n,
  netReceived: -17_000000000000000000n,
  resolvedCount: 2,
  expectedCount: 2,
  missingQuoteIds: [],
  isComplete: true,
};

/** Script the mocked delegate with one batch result (a fresh object per call, as the real hook returns). */
function mockBatch(overrides: {
  rows: Array<QuoteFundingData | null>;
  isLoading?: boolean;
  error?: SymmioRequestError | null;
}): void {
  useQuotesFundingMock.mockReturnValue({
    rows: overrides.rows,
    paid: 0n,
    received: 0n,
    netReceived: 0n,
    missingQuoteIds: [],
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
  });
}

describe("useQuoteGroupFunding", () => {
  beforeEach(() => {
    useQuotesFundingMock.mockReset();
    aggregateGroupFundingMock.mockReset();
    aggregateGroupFundingMock.mockReturnValue(AGGREGATE);
  });

  it("delegates the fetch to useQuotesFunding with the group's children", () => {
    const group = groupOf([FIRST, SECOND]);
    mockBatch({ rows: [FIRST_ROW, SECOND_ROW] });

    renderHook(() => useQuoteGroupFunding({ group, chainId: 999 }));

    expect(useQuotesFundingMock).toHaveBeenCalledWith({ quotes: group.quotes, chainId: 999 });
    /** `group` itself is a grouping concern and must not leak into the read. */
    expect(useQuotesFundingMock.mock.calls[0]![0]).not.toHaveProperty("group");
  });

  it("folds the resolved rows with core's aggregateGroupFunding and returns its result", () => {
    const group = groupOf([FIRST, SECOND]);
    mockBatch({ rows: [FIRST_ROW, SECOND_ROW] });

    const { result } = renderHook(() => useQuoteGroupFunding({ group }));

    expect(aggregateGroupFundingMock).toHaveBeenCalledWith(group.quotes, [FIRST_ROW, SECOND_ROW]);
    expect(result.current.funding).toBe(AGGREGATE);
    /** Negative `netReceived` means the group PAID more funding than it earned. */
    expect(result.current.funding.netReceived < 0n).toBe(true);
  });

  it("passes only the non-null rows to the fold and still returns them aligned 1:1", () => {
    const group = groupOf([FIRST, SECOND, OPTIMISTIC]);
    mockBatch({ rows: [FIRST_ROW, null, null] });

    const { result } = renderHook(() => useQuoteGroupFunding({ group }));

    expect(aggregateGroupFundingMock).toHaveBeenCalledWith(group.quotes, [FIRST_ROW]);
    expect(result.current.rows).toEqual([FIRST_ROW, null, null]);
    expect(result.current.rows).toHaveLength(group.quotes.length);
  });

  it("passes the delegate's query state through", () => {
    const group = groupOf([FIRST]);
    const error = new SymmioRequestError({ kind: "api", message: "subgraph down" });
    mockBatch({ rows: [null], isLoading: true, error });

    const { result } = renderHook(() => useQuoteGroupFunding({ group }));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(error);
  });

  it("stays referentially stable across renders with unchanged inputs", () => {
    const group = groupOf([FIRST, SECOND]);
    mockBatch({ rows: [FIRST_ROW, SECOND_ROW] });

    const { result, rerender } = renderHook(() => useQuoteGroupFunding({ group }));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current.funding).toBe(first.funding);
    /** The fold is memoized, so a bare re-render must not re-run it. */
    expect(aggregateGroupFundingMock).toHaveBeenCalledTimes(1);
  });

  it("re-folds when the delegate returns new rows", () => {
    const group = groupOf([FIRST, SECOND]);
    mockBatch({ rows: [null, null] });

    const { result, rerender } = renderHook(() => useQuoteGroupFunding({ group }));
    const first = result.current;

    mockBatch({ rows: [FIRST_ROW, SECOND_ROW] });
    rerender();

    expect(aggregateGroupFundingMock).toHaveBeenCalledTimes(2);
    expect(aggregateGroupFundingMock).toHaveBeenLastCalledWith(group.quotes, [FIRST_ROW, SECOND_ROW]);
    expect(result.current).not.toBe(first);
  });
});
