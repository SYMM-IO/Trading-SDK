import { InfiniteQueryObserver, onlineManager, QueryClient, type InfiniteData } from "@tanstack/query-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCandleHistoryQueryOptions, type CandleHistoryPage } from "./history-query";
import { refreshCandleHistory } from "./refresh-candle-history";
import type { CandleHistoryRange, CandleSource, GetCandlesReturnType } from "./types";

const START = Date.UTC(2026, 10, 1);
const WIDTH = 300 * 60_000;
const RANGE = { marketName: "TEST", resolution: "1m", from: START, to: START + WIDTH } as const;

function setup(followLatest = false) {
  const getCandles = vi.fn<CandleSource["getCandles"]>(async ({ from }) => ({
    candles: [{ time: from, open: 1, high: 2, low: 1, close: 2, volume: 10 }],
    noMoreData: false,
  }));
  const source: CandleSource = {
    id: "test",
    priceBasis: "price-service",
    supportedResolutions: ["1m"],
    maxCandlesPerRequest: 200,
    getSymbol: async () => undefined,
    getCandles,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const queryOptions = getCandleHistoryQueryOptions(source, { ...RANGE, followLatest });
  const observer = new InfiniteQueryObserver(client, queryOptions);
  function data() {
    return client.getQueryData<InfiniteData<CandleHistoryPage, CandleHistoryRange>>(queryOptions.queryKey)!;
  }
  return { client, getCandles, queryOptions, observer, data };
}

afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("refreshCandleHistory", () => {
  it("refreshes only the corrected window and preserves older windows and exhaustion", async () => {
    const { client, observer, getCandles, queryOptions, data } = setup();
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    getCandles.mockResolvedValueOnce({ candles: [], noMoreData: true });
    await observer.fetchNextPage();
    const before = data();
    getCandles.mockClear();
    getCandles.mockResolvedValueOnce({ candles: [], noMoreData: false });
    await refreshCandleHistory(client, { queryOptions, range: { from: START, to: START + 60_000 } });
    expect(getCandles).toHaveBeenCalledOnce();
    expect(data().pages[0]?.candles).toEqual([]);
    expect(data().pages[1]).toBe(before.pages[1]);
    expect(data().pages[2]).toBe(before.pages[2]);
    expect(data().pages[2]?.noMoreData).toBe(true);
    client.clear();
  });

  it("uses exclusive correction ends and refreshes both windows when a correction crosses a boundary", async () => {
    const { client, observer, getCandles, queryOptions } = setup();
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    getCandles.mockClear();
    await refreshCandleHistory(client, { queryOptions, range: { from: START - 60_000, to: START } });
    expect(getCandles.mock.calls.map(([request]) => request.from)).toEqual([START - 60_000]);
    getCandles.mockClear();
    await refreshCandleHistory(client, { queryOptions, range: { from: START - 60_000, to: START + 60_000 } });
    expect(getCandles.mock.calls.map(([request]) => request.from)).toEqual([START, START - 60_000]);
    client.clear();
  });

  it("advances the newest window for corrections after the initial end when following latest", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(RANGE.to);
    const { client, observer, getCandles, queryOptions, data } = setup(true);
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    getCandles.mockClear();
    vi.setSystemTime(RANGE.to + 120_000);
    await refreshCandleHistory(client, { queryOptions, range: { from: RANGE.to, to: RANGE.to + 60_000 } });
    expect(getCandles).toHaveBeenCalledOnce();
    expect(data().pages[0]?.to).toBe(Date.now());
    client.clear();
  });

  it("does not fetch or alter query state for a correction outside a fixed retained range", async () => {
    const { client, observer, getCandles, queryOptions, data } = setup();
    await observer.fetchNextPage();
    const before = data();
    getCandles.mockClear();
    await refreshCandleHistory(client, { queryOptions, range: { from: START - WIDTH, to: START } });
    expect(getCandles).not.toHaveBeenCalled();
    expect(data()).toBe(before);
    client.clear();
  });

  it("waits for an older page and preserves it before fetching the correction", async () => {
    const { client, observer, getCandles, queryOptions, data } = setup();
    await observer.fetchNextPage();
    let resolve!: (result: GetCandlesReturnType) => void;
    getCandles.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const older = observer.fetchNextPage();
    const signal = getCandles.mock.lastCall?.[0].signal;
    const correction = refreshCandleHistory(client, { queryOptions, range: { from: START, to: START + 60_000 } });
    expect(getCandles).toHaveBeenCalledTimes(2);
    expect(signal?.aborted).toBe(false);
    resolve({ candles: [], noMoreData: false });
    await older;
    await correction;
    expect(getCandles).toHaveBeenCalledTimes(3);
    expect(data().pages).toHaveLength(2);
    expect(data().pages[1]?.from).toBe(START - WIDTH);
    client.clear();
  });

  it("cancels a scheduled correction without cancelling another observer's page", async () => {
    const { client, observer, getCandles, queryOptions } = setup();
    await observer.fetchNextPage();
    let resolve!: (result: GetCandlesReturnType) => void;
    getCandles.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const older = observer.fetchNextPage();
    const signal = getCandles.mock.lastCall?.[0].signal;
    const controller = new AbortController();
    const correction = refreshCandleHistory(client, { queryOptions, range: RANGE, signal: controller.signal });
    controller.abort();
    resolve({ candles: [], noMoreData: false });
    await expect(correction).rejects.toMatchObject({ name: "AbortError" });
    await older;
    expect(signal?.aborted).toBe(false);
    expect(getCandles).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("waits for paging paused offline, then applies the correction after reconnecting", async () => {
    const { client, observer, getCandles, queryOptions, data } = setup();
    client.mount();
    try {
      await observer.fetchNextPage();
      onlineManager.setOnline(false);
      const older = observer.fetchNextPage();
      expect(client.getQueryState(queryOptions.queryKey)?.fetchStatus).toBe("paused");
      const correction = refreshCandleHistory(client, { queryOptions, range: RANGE });
      expect(getCandles).toHaveBeenCalledOnce();
      onlineManager.setOnline(true);
      await older;
      await correction;
      expect(getCandles.mock.calls.map(([request]) => request.from)).toEqual([START, START - WIDTH, START]);
      expect(data().pages).toHaveLength(2);
    } finally {
      client.unmount();
      client.clear();
    }
  });

  it("keeps query errors and retained data, then recovers with a full refresh", async () => {
    const { client, observer, getCandles, queryOptions, data } = setup();
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    const before = data();
    getCandles.mockRejectedValueOnce(new Error("offline"));
    await expect(refreshCandleHistory(client, { queryOptions, range: RANGE })).rejects.toThrow("offline");
    expect(data()).toBe(before);
    expect(client.getQueryState(queryOptions.queryKey)?.status).toBe("error");
    getCandles.mockClear();
    await refreshCandleHistory(client, { queryOptions });
    expect(getCandles).toHaveBeenCalledTimes(2);
    expect(client.getQueryState(queryOptions.queryKey)?.status).toBe("success");
    client.clear();
  });

  it("never leaves a bounded query function behind for later full invalidations", async () => {
    const { client, observer, getCandles, queryOptions } = setup();
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    await refreshCandleHistory(client, { queryOptions, range: RANGE });
    getCandles.mockClear();
    await client.refetchQueries({ queryKey: queryOptions.queryKey, exact: true });
    expect(getCandles).toHaveBeenCalledTimes(3);
    client.clear();
  });
});

it("keeps recent corrections bounded after hours of following live history", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(RANGE.to);
  const { client, observer, getCandles, queryOptions, data } = setup(true);
  await observer.fetchNextPage();
  for (let minute = 1; minute <= 240; minute++) {
    const previousEnd = RANGE.to + (minute - 1) * 60_000;
    vi.setSystemTime(previousEnd + 60_000);
    getCandles.mockClear();
    await refreshCandleHistory(client, {
      queryOptions,
      range: { from: previousEnd - 60_000, to: previousEnd },
    });
    expect(getCandles).toHaveBeenCalledOnce();
    expect(getCandles.mock.calls[0]![0]).toMatchObject({ from: previousEnd - 60_000, to: Date.now() });
  }
  expect(data().pages[0]?.from).toBe(START);
  expect(data().pages[0]?.to).toBe(RANGE.to + 240 * 60_000);
  client.clear();
});

it("preserves unaffected bars and the page exhaustion flag when an interior candle is removed", async () => {
  const { client, observer, getCandles, queryOptions, data } = setup();
  const bar = { open: 1, high: 2, low: 1, close: 2, volume: 10 };
  const candles = [START, START + 60_000, START + 120_000].map((time) => ({ ...bar, time }));
  getCandles.mockResolvedValueOnce({ candles, noMoreData: true });
  await observer.fetchNextPage();
  getCandles.mockResolvedValueOnce({ candles: [], noMoreData: false });
  await refreshCandleHistory(client, { queryOptions, range: { from: START + 60_000, to: START + 120_000 } });
  expect(data().pages[0]?.candles).toEqual([candles[0], candles[2]]);
  expect(data().pages[0]?.noMoreData).toBe(true);
  expect(data().pages[0]?.to).toBe(RANGE.to);
  client.clear();
});

it("fetches a distant correction and a missing live tail separately without redownloading the gap", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(RANGE.to);
  const { client, observer, getCandles, queryOptions } = setup(true);
  await observer.fetchNextPage();
  vi.setSystemTime(RANGE.to + 60_000);
  getCandles.mockClear();
  await refreshCandleHistory(client, { queryOptions, range: { from: START, to: START + 60_000 } });
  expect(getCandles.mock.calls.map(([{ from, to }]) => ({ from, to }))).toEqual([
    { from: START, to: START + 60_000 },
    { from: RANGE.to - 60_000, to: RANGE.to + 60_000 },
  ]);
  client.clear();
});

it("combines a correction overlapping the unfinished bucket with the live tail", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(RANGE.to + 30_000);
  const { client, observer, getCandles, queryOptions } = setup(true);
  await observer.fetchNextPage();
  getCandles.mockClear();
  vi.setSystemTime(RANGE.to + 120_000);
  await refreshCandleHistory(client, {
    queryOptions,
    range: { from: RANGE.to - 60_000, to: RANGE.to },
  });
  expect(getCandles).toHaveBeenCalledOnce();
  expect(getCandles.mock.calls[0]![0]).toMatchObject({ from: RANGE.to - 60_000, to: Date.now() });
  client.clear();
});
