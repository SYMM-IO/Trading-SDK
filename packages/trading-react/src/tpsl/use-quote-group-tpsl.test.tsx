import type { QuoteTpSlRow, TpSlNotification, UnifiedQuote } from "@symmio/trading-core";
import { OrderType, PositionType, QuoteLifecycle, QuoteStatus } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getQuoteTpSlQueryOptions = vi.hoisted(() => vi.fn());
/**
 * Records live `watchTpSlNotifications` subscriptions. Entries are removed on
 * unwatch, so the count reflects what is actually open — StrictMode's
 * mount/unmount/remount would otherwise double every call.
 */
const watchSpy = vi.hoisted(() => ({
  live: [] as Array<{ account: string; onNotification?: (notification: TpSlNotification) => void }>,
}));

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getQuoteTpSlQueryOptions,
    watchTpSlNotifications: (
      _config: unknown,
      parameters: { account: string; onNotification?: (notification: TpSlNotification) => void },
    ) => {
      watchSpy.live.push(parameters);
      return () => {
        const index = watchSpy.live.indexOf(parameters);
        if (index >= 0) watchSpy.live.splice(index, 1);
      };
    },
  };
});

import { __resetTpSlStore } from "./tpsl-store";
import { useQuoteGroupTpSl } from "./use-quote-group-tpsl";

const ONE = 10n ** 18n;
const PARTY_A = "0x00000000000000000000000000000000000000a1" as const;
const VA_ONE = "0x00000000000000000000000000000000000000b1" as const;
const VA_TWO = "0x00000000000000000000000000000000000000b2" as const;

function makeQuote(overrides: Partial<UnifiedQuote> & { key: string }): UnifiedQuote {
  return {
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 1n,
    partyA: PARTY_A,
    vaAddress: VA_ONE,
    symbolId: 7n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    quoteStatus: QuoteStatus.OPENED,
    requestedOpenPrice: 100n * ONE,
    openedPrice: 100n * ONE,
    quantity: 1n * ONE,
    closedAmount: 0n,
    openQuantity: 1n * ONE,
    lockedValues: { cva: 50n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 0n },
    raw: {},
    ...overrides,
  };
}

/** A handler row describing a live take-profit. */
function takeProfitRow(quoteId: number, price: number): QuoteTpSlRow {
  return {
    quote_id: quoteId,
    conditional_order_type: "take_profit",
    conditional_order_price: price,
    price,
    state: "new",
    action_price_type: "market",
    modify_time: 1,
    coh_quote_id: `coh-${quoteId}`,
  } as unknown as QuoteTpSlRow;
}

/** Stub the shared query factory with per-quote row sets. */
function stubRows(rowsByQuoteId: Record<string, QuoteTpSlRow[]>) {
  getQuoteTpSlQueryOptions.mockImplementation((_config: unknown, options: { quoteId: bigint }) => ({
    queryKey: ["getQuoteTpSl", { quoteId: options.quoteId.toString() }] as const,
    queryFn: async () => rowsByQuoteId[options.quoteId.toString()] ?? [],
    enabled: options.quoteId !== 0n,
    retry: false,
  }));
}

beforeEach(() => {
  __resetTpSlStore();
  watchSpy.live.length = 0;
  getQuoteTpSlQueryOptions.mockReset();
});

describe("useQuoteGroupTpSl", () => {
  it("opens one subscription per distinct account, not one per child", async () => {
    stubRows({});
    const quotes = [
      makeQuote({ key: "onchain:1", quoteId: 1n }),
      makeQuote({ key: "onchain:2", quoteId: 2n }),
      makeQuote({ key: "onchain:3", quoteId: 3n }),
    ];

    renderHookWithProviders(() => useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }));

    await waitFor(() => expect(watchSpy.live.length).toBeGreaterThan(0));
    expect(watchSpy.live).toHaveLength(1);
    expect(watchSpy.live[0]!.account).toBe(VA_ONE);
  });

  it("subscribes to every Virtual Account a group spans", async () => {
    stubRows({});
    const quotes = [
      makeQuote({ key: "onchain:1", quoteId: 1n, vaAddress: VA_ONE }),
      makeQuote({ key: "onchain:2", quoteId: 2n, vaAddress: VA_TWO }),
    ];

    renderHookWithProviders(() => useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }));

    await waitFor(() => expect(watchSpy.live).toHaveLength(2));
    expect(watchSpy.live.map((call) => call.account)).toEqual([VA_ONE, VA_TWO]);
  });

  it("honors an explicit accounts override", async () => {
    stubRows({});
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n }), makeQuote({ key: "onchain:2", quoteId: 2n })];

    renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, accounts: [PARTY_A], config: createMockSymmioConfig().config }),
    );

    await waitFor(() => expect(watchSpy.live).toHaveLength(1));
    expect(watchSpy.live[0]!.account).toBe(PARTY_A);
  });

  it("mounts no subscription when live is false", async () => {
    stubRows({});
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n })];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, live: false, config: createMockSymmioConfig().config }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(watchSpy.live).toHaveLength(0);
  });

  it("folds every child's rows into one summary", async () => {
    stubRows({ "1": [takeProfitRow(1, 150)], "2": [takeProfitRow(2, 150)] });
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n }), makeQuote({ key: "onchain:2", quoteId: 2n })];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }),
    );

    await waitFor(() => expect(result.current.summary.takeProfit.count).toBe(2));
    expect(result.current.summary.takeProfit.display).toBe("uniform");
    expect(result.current.summary.takeProfit.price).toBe("150");
    expect(result.current.orders).toHaveLength(2);
  });

  it("queries every child through the shared TP/SL query key", async () => {
    stubRows({});
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n }), makeQuote({ key: "onchain:2", quoteId: 2n })];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const quoteIds = getQuoteTpSlQueryOptions.mock.calls.map((call) => (call[1] as { quoteId: bigint }).quoteId);
    expect(quoteIds).toContain(1n);
    expect(quoteIds).toContain(2n);
  });

  it("keeps an off-chain child in the summary while its query stays idle", async () => {
    stubRows({ "1": [takeProfitRow(1, 150)] });
    const quotes = [
      makeQuote({ key: "onchain:1", quoteId: 1n }),
      makeQuote({ key: "temp:-5", quoteId: undefined, tempQuoteId: -5 }),
    ];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }),
    );

    await waitFor(() => expect(result.current.summary.takeProfit.count).toBe(1));
    // The unprotected leg drags coverage down rather than being hidden.
    expect(result.current.summary.childCount).toBe(2);
    expect(result.current.summary.takeProfit.display).toBe("mixed");
  });

  it("applies a WebSocket frame to the addressed child only", async () => {
    stubRows({ "1": [takeProfitRow(1, 150)], "2": [takeProfitRow(2, 150)] });
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n }), makeQuote({ key: "onchain:2", quoteId: 2n })];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }),
    );
    await waitFor(() => expect(result.current.summary.takeProfit.count).toBe(2));

    act(() => {
      watchSpy.live[0]!.onNotification?.({
        primaryIdentifier: 2,
        secondaryIdentifier: 0,
        quoteId: 2,
        conditionalOrderType: "take_profit",
        state: "cancel",
        successful: true,
      } as TpSlNotification);
    });

    await waitFor(() => expect(result.current.summary.takeProfit.count).toBe(1));
    expect(result.current.children[0]!.tpsl.tp).toBe("150");
    expect(result.current.children[1]!.tpsl.tp).toBe("");
  });

  it("ignores a frame for a quote outside the group", async () => {
    stubRows({ "1": [takeProfitRow(1, 150)] });
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n })];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }),
    );
    await waitFor(() => expect(result.current.summary.takeProfit.count).toBe(1));

    act(() => {
      watchSpy.live[0]!.onNotification?.({
        primaryIdentifier: 99,
        secondaryIdentifier: 0,
        quoteId: 99,
        conditionalOrderType: "take_profit",
        state: "cancel",
        successful: true,
      } as TpSlNotification);
    });

    expect(result.current.summary.takeProfit.count).toBe(1);
  });

  it("layers pending edits over the confirmed snapshots", async () => {
    stubRows({ "1": [takeProfitRow(1, 150)] });
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n })];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({
        quotes,
        overrides: { "onchain:1": { tp: { triggerPrice: "170" } } },
        config: createMockSymmioConfig().config,
      }),
    );

    await waitFor(() => expect(result.current.summary.takeProfit.price).toBe("170"));
  });

  it("refetches every child", async () => {
    stubRows({ "1": [], "2": [] });
    const quotes = [makeQuote({ key: "onchain:1", quoteId: 1n }), makeQuote({ key: "onchain:2", quoteId: 2n })];

    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSl({ quotes, config: createMockSymmioConfig().config }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = getQuoteTpSlQueryOptions.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });

    expect(getQuoteTpSlQueryOptions.mock.calls.length).toBeGreaterThan(before);
  });
});
