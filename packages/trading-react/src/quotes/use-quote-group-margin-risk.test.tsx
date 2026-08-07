import {
  groupQuotes,
  OrderType,
  PositionType,
  QuoteLifecycle,
  QuoteStatus,
  SubAccountIsolationType,
  type QuoteGroup,
  type QuoteGroupingStrategy,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every read is mocked (no network, no provider tree); core's folds run for
 * real, so the assertions below are about wiring, not arithmetic.
 */
const { useAccountMarginRiskMock, useAccountLiquidationPriceMock, useEnigmaPriceByMarketIdMock } = vi.hoisted(() => ({
  useAccountMarginRiskMock: vi.fn(),
  useAccountLiquidationPriceMock: vi.fn(),
  useEnigmaPriceByMarketIdMock: vi.fn(),
}));

vi.mock("../margin/use-account-margin-risk", () => ({ useAccountMarginRisk: useAccountMarginRiskMock }));
vi.mock("./use-account-liquidation-price", () => ({ useAccountLiquidationPrice: useAccountLiquidationPriceMock }));
vi.mock("../price-service/use-enigma-price-by-market-id", () => ({
  useEnigmaPriceByMarketId: useEnigmaPriceByMarketIdMock,
}));

import { useQuoteGroupMarginRisk } from "./use-quote-group-margin-risk";

const PARTY_A: Address = "0x1111111111111111111111111111111111111111";
const VA_A: Address = "0x2222222222222222222222222222222222222222";
const VA_B: Address = "0x3333333333333333333333333333333333333333";

const METRICS = { totalMargin: 1000n, isLiquidatable: false };

function quote(overrides: Partial<UnifiedQuote>): UnifiedQuote {
  const base: UnifiedQuote = {
    key: "onchain:1",
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 1n,
    partyA: PARTY_A,
    vaAddress: VA_A,
    symbolId: 7n,
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
function groupOf(
  quotes: UnifiedQuote[],
  strategy: QuoteGroupingStrategy = SubAccountIsolationType.MARKET_DIRECTION,
): QuoteGroup {
  return groupQuotes(quotes, strategy)[0]!;
}

/** Mark 110 — 10 above the fixtures' entry price. */
const MARK = 110_000000000000000000n;

beforeEach(() => {
  vi.clearAllMocks();
  useAccountMarginRiskMock.mockReturnValue({ metrics: METRICS, isLoading: false, error: null });
  useAccountLiquidationPriceMock.mockReturnValue({ liquidationPrice: 90_000000000000000000n, isLoading: false });
  useEnigmaPriceByMarketIdMock.mockReturnValue({ markPrice: null, isLoading: false });
});

describe("useQuoteGroupMarginRisk", () => {
  it("resolves the group's Virtual Account and folds every child's uPnL", () => {
    const group = groupOf([quote({ key: "onchain:1" }), quote({ key: "onchain:2", quoteId: 2n })]);
    const { result } = renderHook(() => useQuoteGroupMarginRisk({ group, markPrice: MARK }));

    expect(result.current.account).toBe(VA_A);
    expect(result.current.isMultiAccount).toBe(false);
    expect(result.current.metrics).toBe(METRICS);
    // 2 children × (110 − 100) = +20
    expect(result.current.upnl.upnl).toBe(20_000000000000000000n);
    expect(result.current.upnl.isComplete).toBe(true);
    expect(useAccountMarginRiskMock).toHaveBeenCalledWith(
      expect.objectContaining({ account: VA_A, upnl: 20_000000000000000000n }),
    );
  });

  it("uses an injected mark price and opens no price subscription", () => {
    const group = groupOf([quote({})]);
    const { result } = renderHook(() => useQuoteGroupMarginRisk({ group, markPrice: MARK }));

    expect(result.current.markPrice).toBe(MARK);
    expect(useEnigmaPriceByMarketIdMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("subscribes to the group's market when no price is injected", () => {
    const group = groupOf([quote({})]);
    renderHook(() => useQuoteGroupMarginRisk({ group }));

    expect(useEnigmaPriceByMarketIdMock).toHaveBeenCalledWith(expect.objectContaining({ marketId: 7n, enabled: true }));
  });

  it("reports the uPnL as unknown before the feed's first tick", () => {
    const group = groupOf([quote({})]);
    const { result } = renderHook(() => useQuoteGroupMarginRisk({ group }));

    /** Never a fabricated `0n` — that would read as a total loss. */
    expect(result.current.markPrice).toBeUndefined();
    expect(result.current.upnl.isComplete).toBe(false);
    expect(result.current.upnl.upnl).toBe(0n);
  });

  it("falls back to a child's symbolId when the group was keyed without one", () => {
    const group = groupOf([quote({})], { keyOf: () => ({ key: "custom", by: {} }) });
    expect(group.by.symbolId).toBeUndefined();

    renderHook(() => useQuoteGroupMarginRisk({ group }));
    expect(useEnigmaPriceByMarketIdMock).toHaveBeenCalledWith(expect.objectContaining({ marketId: 7n }));
  });

  it("withholds metrics for a group spanning several accounts", () => {
    /** Each Virtual Account liquidates independently, so a blended figure would mislead. */
    const group = groupOf([quote({ key: "onchain:1" }), quote({ key: "onchain:2", quoteId: 2n, vaAddress: VA_B })], {
      keyOf: () => ({ key: "mixed", by: {} }),
    });
    const { result } = renderHook(() => useQuoteGroupMarginRisk({ group, markPrice: MARK }));

    expect(result.current.isMultiAccount).toBe(true);
    expect(result.current.accounts).toEqual([VA_A, VA_B]);
    expect(result.current.metrics).toBeUndefined();
    /** No wasted read for a figure that would be withheld anyway. */
    expect(useAccountMarginRiskMock).toHaveBeenCalledWith(expect.objectContaining({ account: undefined }));
  });

  it("narrows the uPnL fold to the account override", () => {
    /** Guards the equity-mixing bug: one account's balance against every account's uPnL. */
    const group = groupOf([quote({ key: "onchain:1" }), quote({ key: "onchain:2", quoteId: 2n, vaAddress: VA_B })], {
      keyOf: () => ({ key: "mixed", by: {} }),
    });
    const { result } = renderHook(() => useQuoteGroupMarginRisk({ group, markPrice: MARK, account: VA_A }));

    // Only VA_A's single child: 1 × (110 − 100) = +10, not +20.
    expect(result.current.upnl.upnl).toBe(10_000000000000000000n);
  });

  it("takes the liquidation price from the resolved account", () => {
    const group = groupOf([quote({})]);
    const { result } = renderHook(() => useQuoteGroupMarginRisk({ group, markPrice: MARK }));

    expect(useAccountLiquidationPriceMock).toHaveBeenCalledWith(expect.objectContaining({ account: VA_A }));
    expect(result.current.liquidationPrice).toBe(90_000000000000000000n);
  });

  it("returns a referentially stable object across re-renders", () => {
    const group = groupOf([quote({})]);
    const { result, rerender } = renderHook(() => useQuoteGroupMarginRisk({ group, markPrice: MARK }));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
