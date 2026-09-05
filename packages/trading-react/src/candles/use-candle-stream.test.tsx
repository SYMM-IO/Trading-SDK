import type { CandleSource, WatchCandlesParameters } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useCandleStream } from "./use-candle-stream";

const CANDLE = { time: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 };

/** A source whose live feed is driven by the test rather than a socket. */
function createControllableSource() {
  let active: WatchCandlesParameters | undefined;
  const unwatch = vi.fn();

  const source: CandleSource = {
    id: "stub",
    priceBasis: "reference-exchange",
    supportedResolutions: ["1m"],
    maxCandlesPerRequest: 1000,
    getSymbol: vi.fn(async () => undefined),
    getCandles: vi.fn(async () => ({ candles: [], noMoreData: true })),
    watchCandles: vi.fn((parameters: WatchCandlesParameters) => {
      active = parameters;
      return unwatch;
    }),
  };

  return { source, unwatch, emit: () => active };
}

describe("useCandleStream", () => {
  it("subscribes and exposes the latest bar", async () => {
    const { source, emit } = createControllableSource();

    const { result } = renderHookWithProviders(() =>
      useCandleStream({ source, marketName: "BTCUSDT", resolution: "1m" }),
    );

    await waitFor(() => expect(source.watchCandles).toHaveBeenCalledTimes(1));

    act(() => emit()?.onCandle(CANDLE, { closed: false }));
    await waitFor(() => expect(result.current.candle).toEqual(CANDLE));
    expect(result.current.closed).toBe(false);

    act(() => emit()?.onCandle({ ...CANDLE, close: 1.75 }, { closed: true }));
    await waitFor(() => expect(result.current.closed).toBe(true));
    expect(result.current.candle?.close).toBe(1.75);
  });

  it("forwards updates to onCandle ahead of the state update", async () => {
    const { source, emit } = createControllableSource();
    const onCandle = vi.fn();

    renderHookWithProviders(() => useCandleStream({ source, marketName: "BTCUSDT", resolution: "1m", onCandle }));
    await waitFor(() => expect(source.watchCandles).toHaveBeenCalledTimes(1));

    act(() => emit()?.onCandle(CANDLE, { closed: false }));
    expect(onCandle).toHaveBeenCalledWith(CANDLE, { closed: false });
  });

  it("does not re-subscribe when only the handler identity changes", async () => {
    const { source, emit } = createControllableSource();

    const { rerender } = renderHookWithProviders(() =>
      /** A fresh arrow on every render — the hook must read it through a ref. */
      useCandleStream({ source, marketName: "BTCUSDT", resolution: "1m", onCandle: () => {} }),
    );

    await waitFor(() => expect(source.watchCandles).toHaveBeenCalledTimes(1));
    rerender();
    rerender();

    expect(source.watchCandles).toHaveBeenCalledTimes(1);
    expect(emit()).toBeDefined();
  });

  it("relays the source's reset signal", async () => {
    const { source, emit } = createControllableSource();
    const onReset = vi.fn();

    renderHookWithProviders(() => useCandleStream({ source, marketName: "BTCUSDT", resolution: "1m", onReset }));
    await waitFor(() => expect(source.watchCandles).toHaveBeenCalledTimes(1));

    act(() => emit()?.onReset?.());
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("stays unsubscribed when disabled", () => {
    const { source } = createControllableSource();

    const { result } = renderHookWithProviders(() =>
      useCandleStream({ source, marketName: "BTCUSDT", resolution: "1m", enabled: false }),
    );

    expect(source.watchCandles).not.toHaveBeenCalled();
    expect(result.current.status).toBe("closed");
  });

  it("releases the subscription on unmount", async () => {
    const { source, unwatch } = createControllableSource();

    const { unmount } = renderHookWithProviders(() =>
      useCandleStream({ source, marketName: "BTCUSDT", resolution: "1m" }),
    );

    await waitFor(() => expect(source.watchCandles).toHaveBeenCalledTimes(1));
    unmount();

    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("stays closed when the source has no live feed", () => {
    const { source } = createControllableSource();
    delete (source as { watchCandles?: unknown }).watchCandles;

    const { result } = renderHookWithProviders(() =>
      useCandleStream({ source, marketName: "BTCUSDT", resolution: "1m" }),
    );

    expect(result.current.status).toBe("closed");
    expect(result.current.candle).toBeNull();
  });
});
