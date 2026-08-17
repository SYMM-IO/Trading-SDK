import type { Orderbook, OrderbookSource, WatchOrderbookParameters } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useOrderbookStream } from "./use-orderbook-stream";

function book(marketName: string, lastUpdateId: number): Orderbook {
  return {
    marketName,
    bids: [{ price: 99, size: 1 }],
    asks: [{ price: 101, size: 1 }],
    lastUpdateId,
    timestamp: 0,
  };
}

/** A source whose live feed is driven by the test rather than a socket. */
function createControllableSource(overrides: Partial<OrderbookSource> = {}) {
  let active: WatchOrderbookParameters | undefined;
  const unwatch = vi.fn();

  const source: OrderbookSource = {
    id: "stub",
    priceBasis: "reference-exchange",
    supportedLimits: [20, 1000],
    defaultLimit: 1000,
    getSymbol: vi.fn(async () => undefined),
    getOrderbook: vi.fn(async () => book("BTCUSDT", 1)),
    watchOrderbook: vi.fn((parameters: WatchOrderbookParameters) => {
      active = parameters;
      return unwatch;
    }),
    ...overrides,
  };

  return { source, unwatch, emit: () => active };
}

describe("useOrderbookStream", () => {
  it("subscribes and exposes the latest book", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT" }));

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));

    act(() => emit()?.onOrderbook(book("BTCUSDT", 7)));
    await waitFor(() => expect(result.current.orderbook?.lastUpdateId).toBe(7));
  });

  it("passes depth and level bounds through to the source", async () => {
    const { source } = createControllableSource();

    renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT", limit: 20, levels: 15 }));

    await waitFor(() =>
      expect(source.watchOrderbook).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, levels: 15 })),
    );
  });

  it("forwards updates to onOrderbook ahead of the state update", async () => {
    const { source, emit } = createControllableSource();
    const onOrderbook = vi.fn();

    renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT", onOrderbook }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));

    const next = book("BTCUSDT", 4);
    act(() => emit()?.onOrderbook(next));

    expect(onOrderbook).toHaveBeenCalledWith(next);
  });

  it("does not re-subscribe when only the handler identity changes", async () => {
    const { source } = createControllableSource();

    const { rerender } = renderHookWithProviders(() =>
      /** A fresh arrow on every render — the hook must read it through a ref. */
      useOrderbookStream({ source, marketName: "BTCUSDT", onOrderbook: () => {}, onResync: () => {} }),
    );

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    rerender();
    rerender();

    expect(source.watchOrderbook).toHaveBeenCalledTimes(1);
  });

  it("reports a rebuild and clears it when the rebuilt book lands", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT" }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));

    act(() => emit()?.onOrderbook(book("BTCUSDT", 1)));
    await waitFor(() => expect(result.current.orderbook).not.toBeNull());

    act(() => emit()?.onResync?.("sequence-gap"));
    await waitFor(() => expect(result.current.isResyncing).toBe(true));
    expect(result.current.resyncReason).toBe("sequence-gap");
    /** The last good book stays put so a ladder can dim rather than blank. */
    expect(result.current.orderbook?.lastUpdateId).toBe(1);

    act(() => emit()?.onOrderbook(book("BTCUSDT", 2)));
    await waitFor(() => expect(result.current.isResyncing).toBe(false));
  });

  it("forwards socket status", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT" }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));

    act(() => emit()?.onStatusChange?.("open"));
    await waitFor(() => expect(result.current.status).toBe("open"));
  });

  it("normalizes a feed error", async () => {
    const { SymmError } = await import("@symmio/trading-core");
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT" }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));

    act(() => emit()?.onError?.(new SymmError("api", "BOOM", "feed died")));
    await waitFor(() => expect(result.current.error?.message).toContain("feed died"));
  });

  it("drops the previous market's book when the market changes", async () => {
    const { source, unwatch, emit } = createControllableSource();

    const { result, rerender } = renderHookWithProviders(
      ({ marketName }: { marketName: string }) => useOrderbookStream({ source, marketName }),
      { initialProps: { marketName: "BTCUSDT" } },
    );

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));
    act(() => emit()?.onOrderbook(book("BTCUSDT", 5)));
    await waitFor(() => expect(result.current.orderbook?.marketName).toBe("BTCUSDT"));

    rerender({ marketName: "ETHUSDT" });

    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(2));
    expect(unwatch).toHaveBeenCalledTimes(1);
    /** Showing BTC depth under an ETH header would be worse than showing nothing. */
    expect(result.current.orderbook).toBeNull();
  });

  it("never subscribes when disabled", async () => {
    const { source } = createControllableSource();

    const { result } = renderHookWithProviders(() =>
      useOrderbookStream({ source, marketName: "BTCUSDT", enabled: false }),
    );

    await waitFor(() => expect(result.current.status).toBe("closed"));
    expect(source.watchOrderbook).not.toHaveBeenCalled();
  });

  it("releases the subscription on unmount", async () => {
    const { source, unwatch } = createControllableSource();

    const { unmount } = renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT" }));
    await waitFor(() => expect(source.watchOrderbook).toHaveBeenCalledTimes(1));

    unmount();

    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("stays closed rather than throwing when the source has no live feed", async () => {
    const { source } = createControllableSource({ watchOrderbook: undefined });

    const { result } = renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT" }));

    await waitFor(() => expect(result.current.status).toBe("closed"));
    expect(result.current.orderbook).toBeNull();
  });

  it("surfaces a subscription that throws on subscribe", async () => {
    const { SymmError } = await import("@symmio/trading-core");
    const { source } = createControllableSource({
      watchOrderbook: vi.fn(() => {
        throw new SymmError("config", "NO_WEBSOCKET_IMPLEMENTATION", "no socket");
      }),
    });

    const { result } = renderHookWithProviders(() => useOrderbookStream({ source, marketName: "BTCUSDT" }));

    await waitFor(() => expect(result.current.error?.message).toContain("no socket"));
    expect(result.current.status).toBe("closed");
  });
});
