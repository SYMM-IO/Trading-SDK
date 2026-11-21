import { InfiniteQueryObserver, QueryClient, type InfiniteData } from "@tanstack/query-core";
import axios from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { getCandleHistoryQueryOptions, type CandleHistoryPage } from "./history-query";
import { refreshCandleHistory } from "./refresh-candle-history";
import { getLowcapCandles } from "./sources/lowcap/get-lowcap-candles";
import { shiftLowcapCandleTime } from "./sources/lowcap/lowcap-candle-time";
import type { Candle, CandleHistoryRange, CandleResolution, CandleSource } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const cases: { resolution: CandleResolution; start: number }[] = [
  { resolution: "1m", start: Date.UTC(2026, 10, 9) },
  { resolution: "5m", start: Date.UTC(2026, 10, 9) },
  { resolution: "15m", start: Date.UTC(2026, 10, 9) },
  { resolution: "1w", start: Date.UTC(2026, 10, 9) },
  { resolution: "1M", start: Date.UTC(2026, 0, 1) },
  { resolution: "1M", start: Date.UTC(2028, 1, 1) },
  { resolution: "1M", start: Date.UTC(2026, 1, 1) },
];

it.each(cases.flatMap((entry) => ["completed", "removed", "appeared"].map((change) => ({ ...entry, change }))))(
  "reconciles a $change $resolution candle across a later correction ($start)",
  async ({ resolution, start, change }) => {
    vi.useFakeTimers();
    const next = shiftLowcapCandleTime(start, resolution, 1);
    const latest = shiftLowcapCandleTime(start, resolution, 2);
    const from = shiftLowcapCandleTime(start, resolution, -2);
    // Near the end of a 31-day month, a nominal 30-day overlap misses its start.
    const initialEnd = next - Math.min(30_000, (next - start) / 2);
    vi.setSystemTime(initialEnd);
    const partial: Candle = { time: start, open: 10, high: 11, low: 9, close: 10, volume: 1 };
    const completed: Candle = { ...partial, high: 20, low: 5, close: 17, volume: 50 };
    let rows = change === "appeared" ? [] : [partial];
    vi.spyOn(axios, "get").mockImplementation(async (_url, config) => ({
      data: {
        has_older: false,
        result: rows
          .filter(
            (bar) => bar.time >= Date.parse(config!.params.from_date) && bar.time <= Date.parse(config!.params.to_date),
          )
          .map(({ time, ...bar }) => ({ timestamp: time / 1000, ...bar })),
      },
    }));
    const source: CandleSource = {
      id: "partial-history",
      priceBasis: "price-service",
      supportedResolutions: [resolution],
      maxCandlesPerRequest: 200,
      getSymbol: async () => undefined,
      getCandles: (parameters) =>
        getLowcapCandles({
          ...parameters,
          baseURL: "https://prices.example",
          symbolAddress: "test",
          includeFlat: false,
        }),
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const options = getCandleHistoryQueryOptions(source, {
      marketName: "TEST",
      resolution,
      from,
      to: initialEnd,
      followLatest: true,
    });
    const observer = new InfiniteQueryObserver(client, options);
    try {
      await observer.fetchNextPage();
      rows = [...(change === "removed" ? [] : [completed]), { ...completed, time: next }, { ...partial, time: latest }];
      vi.setSystemTime(latest + 30_000);
      await refreshCandleHistory(client, { queryOptions: options, range: { from: next, to: latest } });
      const data = client.getQueryData<InfiniteData<CandleHistoryPage, CandleHistoryRange>>(options.queryKey)!;
      expect(data.pages[0]?.candles).toEqual(rows);
      expect(data.pages[0]).toMatchObject({ from, to: Date.now(), noMoreData: true });
      expect(new Set(data.pages[0]?.candles.map((bar) => bar.time)).size).toBe(rows.length);
    } finally {
      client.clear();
    }
  },
);
