import type { Orderbook, OrderbookSource, OrderbookSymbol, WatchOrderbookParameters } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useLiveOrderbook } from "./use-live-orderbook";

const BTC_SYMBOL: OrderbookSymbol = {
  marketName: "BTCUSDT",
  sourceSymbol: "BTCUSDT",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  pricePrecision: 1,
  sizePrecision: 3,
  tickSize: 0.1,
};

/**
 * A book whose levels land in distinct 1-unit buckets, so grouping at `1` has a
 * visible and checkable effect.
 */
function book(midShift = 0): Orderbook {
  return {
    marketName: "BTCUSDT",
    bids: [
      { price: 100.9 + midShift, size: 1 },
      { price: 100.4 + midShift, size: 2 },
      { price: 99.6 + midShift, size: 4 },
    ],
    asks: [
      { price: 101.1 + midShift, size: 1 },
      { price: 101.6 + midShift, size: 2 },
      { price: 102.4 + midShift, size: 8 },
    ],
    lastUpdateId: 1,
    timestamp: 0,
  };
}

/**
 * `symbol` is an options field rather than a defaulted positional: passing
 * `undefined` positionally selects the default, which would silently give an
 * "unlisted market" test a listed one.
 */
function createControllableSource(options: { symbol?: OrderbookSymbol | null } = {}) {
  const symbol = options.symbol === undefined ? BTC_SYMBOL : (options.symbol ?? undefined);
  let active: WatchOrderbookParameters | undefined;
  const unwatch = vi.fn();

  const source: OrderbookSource = {
    id: "stub",
    priceBasis: "reference-exchange",
    supportedLimits: [20, 1000],
    defaultLimit: 1000,
    getSymbol: vi.fn(async () => symbol),
    getOrderbook: vi.fn(async () => book()),
    watchOrderbook: vi.fn((parameters: WatchOrderbookParameters) => {
      active = parameters;
      return unwatch;
    }),
  };

  return { source, unwatch, emit: () => active };
}

describe("useLiveOrderbook", () => {
  it("groups rows onto the requested tick", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", tickSize: 1 }));

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    /** Bids round down and asks up, so a group never overstates its price. */
    await waitFor(() => expect(result.current.bids).toHaveLength(2));
    expect(result.current.bids[0]).toMatchObject({ price: 100, size: 3 });
    expect(result.current.asks[0]).toMatchObject({ price: 102, size: 3 });
  });

  it("attaches inclusive cumulative totals", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", tickSize: 1 }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    /** Inclusive: the touch row carries its own size, so it is never zero. */
    await waitFor(() => expect(result.current.bids[0]?.total).toBe(3));
    expect(result.current.bids[1]?.total).toBe(7);
  });

  it("reports maxTotal across both sides so callers can share one scale", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", tickSize: 1 }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    /** Bids total 7, asks total 11 — the deeper side wins. */
    await waitFor(() => expect(result.current.maxTotal).toBe(11));
  });

  it("computes the spread from the ungrouped book", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", tickSize: 1 }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    /**
     * Grouping moves the touch prices to 100 and 102. Reading the spread off the
     * grouped rows would report 2.0 where the real spread is 0.2.
     */
    await waitFor(() => expect(result.current.spread?.bestBid).toBe(100.9));
    expect(result.current.spread?.bestAsk).toBe(101.1);
    expect(result.current.spread?.spread).toBeCloseTo(0.2, 6);
  });

  it("caps each side at the requested row count", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", rows: 2 }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    await waitFor(() => expect(result.current.bids).toHaveLength(2));
    expect(result.current.asks).toHaveLength(2);
  });

  it("defaults grouping to the venue tick, i.e. no grouping", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT" }));
    await waitFor(() => expect(result.current.symbol?.tickSize).toBe(0.1));
    act(() => emit()?.onOrderbook(book()));

    await waitFor(() => expect(result.current.tickSize).toBe(0.1));
    expect(result.current.bids).toHaveLength(3);
  });

  it("derives grouping options from the venue tick", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT" }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    await waitFor(() => expect(result.current.tickSizeOptions[0]).toBe(0.1));
    expect(result.current.tickSizeOptions).toEqual([0.1, 0.2, 0.5]);
  });

  it("holds the grouping options still while the mid drifts", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT" }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));

    act(() => emit()?.onOrderbook(book()));
    await waitFor(() => expect(result.current.tickSizeOptions).toHaveLength(3));
    const first = result.current.tickSizeOptions;

    /** A selector must not be handed a new array several times a second. */
    act(() => emit()?.onOrderbook(book(0.3)));
    await waitFor(() => expect(result.current.orderbook?.bids[0]?.price).toBeCloseTo(101.2, 6));
    expect(result.current.tickSizeOptions).toBe(first);
  });

  it("flags a market the source does not carry and never subscribes", async () => {
    const { source } = createControllableSource({ symbol: null });

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "LOWCAP" }));

    await waitFor(() => expect(result.current.isUnsupported).toBe(true));
    expect(source.watchOrderbook).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("is loading until the first book lands", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT" }));

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    expect(result.current.isLoading).toBe(true);

    act(() => emit()?.onOrderbook(book()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("exposes symbol metadata for column headers and precision", async () => {
    const { source } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT" }));

    await waitFor(() => expect(result.current.symbol).toMatchObject({ baseAsset: "BTC", quoteAsset: "USDT" }));
    expect(result.current.symbol?.pricePrecision).toBe(1);
  });

  it("surfaces the raw book for callers doing their own aggregation", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", tickSize: 1 }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    await waitFor(() => expect(result.current.orderbook?.bids).toHaveLength(3));
  });

  it("honours an explicit level budget", async () => {
    const { source } = createControllableSource();

    renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", levels: 400, rows: 15 }));

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledWith(expect.objectContaining({ levels: 400 })));
  });

  it("streams enough levels to fill the requested rows at the venue tick", async () => {
    const { source } = createControllableSource();

    renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", rows: 5 }));

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledWith(expect.objectContaining({ levels: 100 })));
  });

  it("raises the level budget as the grouping coarsens, so a coarse tick does not starve the ladder", async () => {
    const { source } = createControllableSource();

    /**
     * The bug this guards: at 50x the venue tick each row swallows up to 50
     * levels, so a fixed budget renders a half-empty ladder with dead space
     * where the missing rows should be.
     */
    renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", rows: 15, tickSize: 5 }));

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledWith(expect.objectContaining({ levels: 1000 })));
  });

  it("returns exactly `rows` per side when the book has the depth for it", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", rows: 2 }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book()));

    await waitFor(() => expect(result.current.bids).toHaveLength(2));
    expect(result.current.asks).toHaveLength(2);
  });

  it("does not subscribe when disabled", async () => {
    const { source } = createControllableSource();

    renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT", enabled: false }));

    await waitFor(() => expect(source.getSymbol).not.toHaveBeenCalled());
    expect(source.watchOrderbook).not.toHaveBeenCalled();
  });

  it("returns empty rows before any book arrives", () => {
    const { source } = createControllableSource();

    const { result } = renderHookWithProviders(() => useLiveOrderbook({ source, marketName: "BTCUSDT" }));

    expect(result.current.bids).toEqual([]);
    expect(result.current.asks).toEqual([]);
    expect(result.current.maxTotal).toBe(0);
    expect(result.current.spread).toBeUndefined();
  });
});
