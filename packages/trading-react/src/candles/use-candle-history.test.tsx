import type { CandleSource, GetCandlesReturnType } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useCandleHistory } from "./use-candle-history";

const START = Date.UTC(2026, 10, 1);
const RANGE = { marketName: "TEST", resolution: "1h", from: START, to: START + 300 * 3_600_000 } as const;
function bar(time: number) {
  return { time, open: 1, high: 1, low: 1, close: 1, volume: 0 };
}
function setup() {
  const getCandles = vi.fn<CandleSource["getCandles"]>(async ({ from }) => ({
    candles: [bar(from)],
    noMoreData: false,
  }));
  const source: CandleSource = {
    id: "test",
    priceBasis: "reference-exchange",
    supportedResolutions: ["1h"],
    maxCandlesPerRequest: 1000,
    getSymbol: async () => undefined,
    getCandles,
  };
  return { source, getCandles };
}

describe("useCandleHistory", () => {
  it("full refresh cancels an older page and queued correction without letting late work replace fresh history", async () => {
    const { source, getCandles } = setup();
    const { result } = renderHookWithProviders(() => useCandleHistory({ source, ...RANGE }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    let resolve!: (value: GetCandlesReturnType) => void;
    getCandles.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => {
      void result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    const signal = getCandles.mock.lastCall?.[0].signal;
    const correction = result.current.refresh({ from: START, to: START + 3_600_000 });
    getCandles.mockResolvedValueOnce({ candles: [{ ...bar(START), close: 3 }], noMoreData: false });
    await act(async () => {
      await result.current.refresh();
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve({ candles: [bar(START - 1)], noMoreData: true });
    });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    await correction;
    expect(getCandles).toHaveBeenCalledTimes(3);
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.candles[0]?.close).toBe(3);
    expect(result.current.data?.noMoreData).toBe(false);
  });

  it("refreshes the corrected window, preserves older pages, and exposes normalized correction errors", async () => {
    const { source, getCandles } = setup();
    const { result } = renderHookWithProviders(() => useCandleHistory({ source, ...RANGE }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    await act(async () => {
      await result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(3));
    const before = result.current.data!;
    getCandles.mockClear();
    getCandles.mockResolvedValueOnce({ candles: [{ ...bar(START), volume: 20 }], noMoreData: false });
    await act(async () => {
      await result.current.refresh({ from: START, to: START + 3_600_000 });
    });
    await waitFor(() => expect(result.current.data?.candles.at(-1)?.volume).toBe(20));
    expect(getCandles).toHaveBeenCalledOnce();
    expect(result.current.data?.pages[1]).toBe(before.pages[1]);
    expect(result.current.data?.pages[2]).toBe(before.pages[2]);

    getCandles.mockRejectedValueOnce(new Error("correction unavailable"));
    await act(async () => {
      await result.current.refresh({ from: START, to: START + 3_600_000 });
    });
    await waitFor(() =>
      expect(result.current.error).toMatchObject({ kind: "unknown", message: "correction unavailable" }),
    );
    expect(result.current.data?.pages).toHaveLength(3);
    getCandles.mockClear();
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCandles).toHaveBeenCalledTimes(3);
  });

  it("keeps an unfinished older page when a bounded correction arrives", async () => {
    const { source, getCandles } = setup();
    const { result } = renderHookWithProviders(() => useCandleHistory({ source, ...RANGE }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    let resolve!: (value: GetCandlesReturnType) => void;
    getCandles.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => {
      void result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    const signal = getCandles.mock.lastCall?.[0].signal;
    const correction = result.current.refresh({ from: START, to: START + 3_600_000 });
    expect(getCandles).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolve({ candles: [bar(START - 300 * 3_600_000)], noMoreData: false });
      await correction;
    });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(signal?.aborted).toBe(false);
    expect(result.current.data?.pages).toHaveLength(2);
    expect(getCandles).toHaveBeenCalledTimes(3);
  });

  it.each(["market switch", "unmount"])("discards a queued correction after %s", async (change) => {
    const { source, getCandles } = setup();
    const { result, rerender, unmount } = renderHookWithProviders(
      ({ marketName }) => useCandleHistory({ source, ...RANGE, marketName }),
      { initialProps: { marketName: "FIRST" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    let resolve!: (value: GetCandlesReturnType) => void;
    getCandles.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => {
      void result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    const correction = result.current.refresh({ from: START, to: START + 3_600_000 });
    if (change === "market switch") rerender({ marketName: "SECOND" });
    else unmount();
    await act(async () => {
      resolve({ candles: [], noMoreData: true });
      await correction;
    });
    expect(getCandles.mock.calls.filter(([request]) => request.marketName === "FIRST")).toHaveLength(2);
    if (change === "market switch") {
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.noMoreData).toBe(false);
    }
  });
  it("retains pages, deduplicates concurrent gestures, and does not automatically search across empty windows", async () => {
    const { source, getCandles } = setup();
    const { result } = renderHookWithProviders(() => useCandleHistory({ source, ...RANGE }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    let resolve!: (value: GetCandlesReturnType) => void;
    getCandles.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => {
      void result.current.loadOlder();
      void result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    expect(getCandles).toHaveBeenCalledTimes(2);
    expect(result.current.data?.candles).toEqual([bar(START)]);
    await act(async () => {
      resolve({ candles: [], noMoreData: false });
    });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(getCandles).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(3));
    expect(getCandles.mock.lastCall?.[0].to).toBe(START - 300 * 3_600_000);
    expect(result.current.data?.candles).toHaveLength(2);
  });

  it("keeps successful history after a failed older page and retries the same cursor after refresh", async () => {
    const { source, getCandles } = setup();
    const { result } = renderHookWithProviders(() => useCandleHistory({ source, ...RANGE }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    getCandles.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.error?.message).toContain("offline"));
    expect(result.current.data?.candles).toEqual([bar(START)]);
    await act(async () => {
      await result.current.loadOlder();
    });
    expect(getCandles).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.loadOlder();
    });
    expect(getCandles.mock.lastCall?.[0].from).toBe(getCandles.mock.calls[1]?.[0].from);
  });

  it("stops on a confirmed boundary and isolates market or resolution changes", async () => {
    const { source, getCandles } = setup();
    getCandles.mockResolvedValue({ candles: [], noMoreData: true });
    const { result, rerender } = renderHookWithProviders(
      ({ marketName }) => useCandleHistory({ source, ...RANGE, marketName }),
      { initialProps: { marketName: "FIRST" } },
    );
    await waitFor(() => expect(result.current.data?.noMoreData).toBe(true));
    await act(async () => {
      await result.current.loadOlder();
    });
    expect(getCandles).toHaveBeenCalledOnce();
    rerender({ marketName: "SECOND" });
    await waitFor(() => expect(getCandles).toHaveBeenCalledTimes(2));
    expect(getCandles.mock.lastCall?.[0].marketName).toBe("SECOND");
  });

  it("cancels obsolete pages on a market switch and ignores a transport that resolves after abort", async () => {
    const { source, getCandles } = setup();
    let resolve!: (value: GetCandlesReturnType) => void;
    getCandles.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { result, rerender, unmount } = renderHookWithProviders(
      ({ marketName }) => useCandleHistory({ source, ...RANGE, marketName }),
      { initialProps: { marketName: "FIRST" } },
    );
    await waitFor(() => expect(getCandles).toHaveBeenCalledOnce());
    const signal = getCandles.mock.calls[0]?.[0].signal;
    rerender({ marketName: "SECOND" });
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      resolve({ candles: [], noMoreData: true });
    });
    expect(result.current.data?.candles).toEqual([bar(START)]);
    getCandles.mockImplementationOnce(() => new Promise(() => {}));
    act(() => {
      void result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    unmount();
    expect(getCandles.mock.lastCall?.[0].signal?.aborted).toBe(true);
  });
});
