import { InfiniteQueryObserver, QueryClient } from "@tanstack/query-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCandleHistoryQueryOptions, type CandleHistoryPage } from "./history-query";
import { mergeCandlePages } from "./merge-candle-pages";
import type { CandleSource } from "./types";

const START = Date.UTC(2026, 10, 1);
const HOUR = 3_600_000;
const RANGE = { marketName: "TEST", resolution: "1h", from: START, to: START + 300 * HOUR } as const;

function bar(time: number, close = 1) {
  return { time, open: 1, high: close, low: 1, close, volume: 0 };
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { source, getCandles, client };
}

afterEach(() => vi.useRealTimers());

describe("incremental candle history", () => {
  it("requests adjacent windows, traverses empty pages, and stops only at a confirmed boundary", async () => {
    const { source, getCandles, client } = setup();
    const observer = new InfiniteQueryObserver(client, getCandleHistoryQueryOptions(source, RANGE));
    await observer.fetchNextPage();
    getCandles.mockResolvedValueOnce({ candles: [], noMoreData: false });
    await observer.fetchNextPage();
    getCandles.mockResolvedValueOnce({ candles: [bar(START - 600 * HOUR)], noMoreData: true });
    await observer.fetchNextPage();
    expect(getCandles.mock.calls.map(([request]) => [request.from, request.to])).toEqual([
      [START, RANGE.to],
      [START - 300 * HOUR, START],
      [START - 600 * HOUR, START - 300 * HOUR],
    ]);
    expect(observer.getCurrentResult().data?.candles.map((candle) => candle.time)).toEqual([START - 600 * HOUR, START]);
    expect(observer.getCurrentResult().hasNextPage).toBe(false);
    await observer.fetchNextPage();
    expect(getCandles).toHaveBeenCalledTimes(3);
    expect(getCandles.mock.calls.every(([request]) => request.limit === undefined)).toBe(true);
    client.clear();
  });

  it("refreshes retained windows including removals and advances only the newest window when following live time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(RANGE.to);
    const { source, getCandles, client } = setup();
    const observer = new InfiniteQueryObserver(
      client,
      getCandleHistoryQueryOptions(source, { ...RANGE, followLatest: true }),
    );
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    vi.setSystemTime(RANGE.to + HOUR);
    getCandles.mockResolvedValueOnce({ candles: [bar(RANGE.to, 3)], noMoreData: false });
    getCandles.mockResolvedValueOnce({ candles: [], noMoreData: false });
    await observer.refetch();
    expect(getCandles.mock.calls.slice(2).map(([request]) => [request.from, request.to])).toEqual([
      [START, RANGE.to + HOUR],
      [START - 300 * HOUR, START],
    ]);
    expect(observer.getCurrentResult().data?.candles).toEqual([bar(RANGE.to, 3)]);
    client.clear();
  });

  it("keeps fixed historical windows fixed on refresh", async () => {
    const { source, getCandles, client } = setup();
    const observer = new InfiniteQueryObserver(client, getCandleHistoryQueryOptions(source, RANGE));
    await observer.fetchNextPage();
    await observer.refetch();
    expect(getCandles.mock.lastCall?.[0].to).toBe(RANGE.to);
    client.clear();
  });

  it("merges once by timestamp, preserving source-provided flat candles and using the newest window for overlap", () => {
    const pages: CandleHistoryPage[] = [
      { from: 20, to: 40, candles: [bar(20, 2), bar(30)], noMoreData: false },
      { from: 0, to: 30, candles: [bar(0), bar(20)], noMoreData: true },
    ];
    expect(mergeCandlePages(pages)).toEqual({ candles: [bar(0), bar(20, 2), bar(30)], noMoreData: true });
  });

  it("rejects invalid ranges through query state before fetching", async () => {
    const { source, getCandles, client } = setup();
    const observer = new InfiniteQueryObserver(client, getCandleHistoryQueryOptions(source, { ...RANGE, to: START }));
    const result = await observer.fetchNextPage();
    expect(result.error).toMatchObject({ code: "INVALID_CANDLE_RANGE" });
    expect(getCandles).not.toHaveBeenCalled();
    client.clear();
  });
});
