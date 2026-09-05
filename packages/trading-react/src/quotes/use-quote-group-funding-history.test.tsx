import type { GetQuotesEventsByTypeReturnType, QuoteGroup, UnifiedQuote } from "@symmio/trading-core";
import {
  FUNDING_HISTORY_EVENT_TYPES,
  OrderType,
  PositionType,
  QuoteEventType,
  QuoteLifecycle,
  QuoteStatus,
} from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getQuotesEventsByTypeQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getQuotesEventsByTypeQueryOptions };
});

import { useQuoteGroupFundingHistory } from "./use-quote-group-funding-history";

const ONE = 10n ** 18n;
const PARTY_A = "0x00000000000000000000000000000000000000a1" as const;
const VA = "0x00000000000000000000000000000000000000b2" as const;

/** Minimal on-chain child quote; pass `quoteId: undefined` for an optimistic row. */
function makeChild(overrides: Partial<UnifiedQuote> & { key: string }): UnifiedQuote {
  const base: UnifiedQuote = {
    key: overrides.key,
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 1n,
    partyA: PARTY_A,
    vaAddress: VA,
    symbolId: 7n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    quoteStatus: QuoteStatus.OPENED,
    requestedOpenPrice: 100n * ONE,
    quantity: 1n * ONE,
    closedAmount: 0n,
    openQuantity: 1n * ONE,
    lockedValues: { cva: 50n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 0n },
    raw: {},
  };
  return { ...base, ...overrides };
}

function makeGroup(quotes: UnifiedQuote[]): QuoteGroup {
  return {
    key: "group:7",
    by: { symbolId: 7n },
    vaAddress: VA,
    quotes,
    isAggregate: quotes.length > 1,
    metrics: {
      quoteCount: quotes.length,
      openCount: quotes.length,
      pendingCount: 0,
      quantity: quotes.reduce((sum, quote) => sum + quote.quantity, 0n),
      openQuantity: quotes.reduce((sum, quote) => sum + quote.openQuantity, 0n),
      weightedOpenPrice: undefined,
      initialNotional: 0n,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
      leverage: undefined,
    },
  };
}

const RESULT: GetQuotesEventsByTypeReturnType = {
  rows: [
    {
      eventId: "e2",
      quoteId: 8233n,
      type: QuoteEventType.ChargeFundingRate,
      timestamp: 1782000600,
      fundingPaid: 3n,
      fundingReceived: 0n,
      rate: 12n,
      rawMetadata: null,
    },
    {
      eventId: "e1",
      quoteId: 8232n,
      type: QuoteEventType.ChargeFundingRate,
      timestamp: 1782000000,
      fundingPaid: 0n,
      fundingReceived: 5n,
      rate: -7n,
      rawMetadata: null,
    },
  ],
  hasMore: false,
};

/** The options object the hook handed to the core factory on its first call. */
function firstCallOptions() {
  const call = getQuotesEventsByTypeQueryOptions.mock.calls[0];
  expect(call).toBeDefined();
  return call![1] as { quoteIds: readonly bigint[]; types: readonly QuoteEventType[]; chainId?: number };
}

describe("useQuoteGroupFundingHistory", () => {
  afterEach(() => {
    getQuotesEventsByTypeQueryOptions.mockReset();
  });

  it("merges the group's on-chain children into one request, dropping optimistic rows and duplicates", async () => {
    const { config } = createMockSymmioConfig();
    getQuotesEventsByTypeQueryOptions.mockReturnValue({
      queryKey: ["getQuotesEventsByType", { quoteIds: ["8232", "8233"] }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const group = makeGroup([
      makeChild({ key: "a", quoteId: 8232n }),
      makeChild({ key: "b", quoteId: 8233n }),
      /** Same on-chain id as `a` — must collapse. */
      makeChild({ key: "c", quoteId: 8232n }),
      /** Optimistic: no on-chain id, no subgraph events. */
      makeChild({ key: "d", quoteId: undefined, origin: "offchain", lifecycle: QuoteLifecycle.OPTIMISTIC }),
    ]);

    const { result } = renderHookWithProviders(() => useQuoteGroupFundingHistory({ group, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getQuotesEventsByTypeQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
    expect(firstCallOptions().quoteIds).toEqual([8232n, 8233n]);
  });

  it("locks `types` to the funding-history preset", async () => {
    const { config } = createMockSymmioConfig();
    getQuotesEventsByTypeQueryOptions.mockReturnValue({
      queryKey: ["getQuotesEventsByType", { quoteIds: ["8232"] }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const group = makeGroup([makeChild({ key: "a", quoteId: 8232n })]);
    const { result } = renderHookWithProviders(() => useQuoteGroupFundingHistory({ group, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(firstCallOptions().types).toBe(FUNDING_HISTORY_EVENT_TYPES);
  });

  it("forwards paging and sort options untouched", async () => {
    const { config } = createMockSymmioConfig();
    getQuotesEventsByTypeQueryOptions.mockReturnValue({
      queryKey: ["getQuotesEventsByType", { quoteIds: ["8232"] }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const group = makeGroup([makeChild({ key: "a", quoteId: 8232n })]);
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupFundingHistory({ group, first: 100, skip: 100, orderDirection: "asc", config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getQuotesEventsByTypeQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ first: 100, skip: 100, orderDirection: "asc" }),
    );
  });

  it("passes no quote ids when every child is still optimistic", () => {
    const { config } = createMockSymmioConfig();
    getQuotesEventsByTypeQueryOptions.mockReturnValue({
      queryKey: ["getQuotesEventsByType", { quoteIds: [] }],
      enabled: false,
      queryFn: vi.fn(),
    });

    const group = makeGroup([
      makeChild({ key: "a", quoteId: undefined, origin: "offchain", lifecycle: QuoteLifecycle.OPTIMISTIC }),
      makeChild({ key: "b", quoteId: undefined, origin: "offchain", lifecycle: QuoteLifecycle.OPTIMISTIC }),
    ]);

    renderHookWithProviders(() => useQuoteGroupFundingHistory({ group, config }));

    expect(firstCallOptions().quoteIds).toEqual([]);
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getQuotesEventsByTypeQueryOptions.mockReturnValue({
      queryKey: ["getQuotesEventsByType", { quoteIds: ["8232"] }],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const group = makeGroup([makeChild({ key: "a", quoteId: 8232n })]);
    const { result } = renderHookWithProviders(() => useQuoteGroupFundingHistory({ group, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
