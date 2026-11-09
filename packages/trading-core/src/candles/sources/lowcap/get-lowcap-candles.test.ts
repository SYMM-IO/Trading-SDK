import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLowcapCandles, type LowcapHistoryParameters } from "./get-lowcap-candles";
import { floorLowcapCandleTime, shiftLowcapCandleTime } from "./lowcap-candle-time";
import { getLowcapSupportedResolutions } from "./map-resolution";

const get = vi.spyOn(axios, "get");
const MINUTE = 60_000;
const START = Date.UTC(2026, 9, 1);
const OPTIONS: LowcapHistoryParameters = {
  baseURL: "https://prices.example",
  symbolAddress: "MixedCaseAddress",
  marketName: "TOKEN::a_SFLOW",
  resolution: "1m",
  from: START,
  to: START + 450 * MINUTE,
  includeFlat: true,
};

function bar(time: number, price = 2, volume = 10) {
  return { timestamp: time / 1000, open: price, high: price, low: price, close: price, volume };
}

function serve(rows: ReturnType<typeof bar>[], metadata = true) {
  get.mockImplementation(async (_url, config) => {
    const from = Date.parse(config!.params.from_date);
    const to = Date.parse(config!.params.to_date);
    return {
      data: {
        result: rows.filter((row) => row.timestamp * 1000 >= from && row.timestamp * 1000 <= to),
        ...(metadata ? { hasOlder: rows.some((row) => row.timestamp * 1000 < from) } : {}),
      },
    };
  });
}

describe("getLowcapCandles", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("returns every bar across >200 intervals once, in milliseconds, omitting the vendor limit", async () => {
    const rows = Array.from({ length: 451 }, (_, index) => bar(START + index * MINUTE, index + 1));
    serve(rows);
    const result = await getLowcapCandles(OPTIONS);
    expect(result.candles.map((candle) => candle.time)).toEqual(rows.slice(0, -1).map((row) => row.timestamp * 1000));
    expect(result.noMoreData).toBe(true);
    expect(get).toHaveBeenCalledTimes(3);
    for (const [url, config] of get.mock.calls) {
      expect(url).toBe("/api/v1/prices/MixedCaseAddress/ohlcv");
      expect(config?.params).toMatchObject({ version: 2, flat_enable: true });
      expect(config?.params).not.toHaveProperty("limit");
      expect(
        (Date.parse(config!.params.to_date) - Date.parse(config!.params.from_date)) / MINUTE + 1,
      ).toBeLessThanOrEqual(200);
    }
  });

  it("continues through an empty middle page and stops at a confirmed beginning", async () => {
    serve([bar(START), bar(START + 449 * MINUTE)]);
    const result = await getLowcapCandles(OPTIONS);
    expect(result.candles.map((candle) => candle.time)).toEqual([START, START + 449 * MINUTE]);
    expect(result.noMoreData).toBe(true);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("does not equate today's empty result with exhausted history", async () => {
    serve([], false);
    expect(await getLowcapCandles(OPTIONS)).toEqual({ candles: [], noMoreData: false });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("returns no error for a confirmed no-history market", async () => {
    serve([]);
    expect(await getLowcapCandles(OPTIONS)).toEqual({ candles: [], noMoreData: true });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each([null, "false", 0])("rejects malformed hasOlder=%s instead of coercing it", async (hasOlder) => {
    get.mockResolvedValue({ data: { result: [], hasOlder } });
    await expect(getLowcapCandles(OPTIONS)).rejects.toMatchObject({ code: "INVALID_ENIGMA_OHLCV_RESPONSE" });
  });

  it("does not declare exhaustion when a consumer limit trims older returned bars", async () => {
    serve(Array.from({ length: 10 }, (_, index) => bar(START + index * MINUTE)));
    const result = await getLowcapCandles({ ...OPTIONS, to: START + 10 * MINUTE, limit: 3 });
    expect(result.candles.map((candle) => candle.time)).toEqual([7, 8, 9].map((index) => START + index * MINUTE));
    expect(result.noMoreData).toBe(false);
  });

  it("filters by candle starts without sending partial-bucket from dates", async () => {
    serve([bar(START), bar(START + MINUTE), bar(START + 2 * MINUTE)]);
    const result = await getLowcapCandles({ ...OPTIONS, from: START + 1, to: START + MINUTE + 1 });
    expect(result.candles).toHaveLength(1);
    expect(result.candles[0]?.time).toBe(START + MINUTE);
    expect(get.mock.calls[0]?.[1]?.params).toMatchObject({
      from_date: new Date(START + MINUTE).toISOString(),
      to_date: new Date(START + 2 * MINUTE).toISOString(),
    });
  });

  it("keeps flat intervals when explicitly included, including all page-boundary bars", async () => {
    serve(Array.from({ length: 450 }, (_, index) => bar(START + index * MINUTE, 2, 0)));
    expect((await getLowcapCandles(OPTIONS)).candles).toHaveLength(450);
  });

  it("keeps the first, volume-bearing and changed-price candles when filtering across pages", async () => {
    serve(
      Array.from({ length: 450 }, (_, index) =>
        bar(START + index * MINUTE, index >= 420 ? 3 : 2, index === 310 ? 10 : 0),
      ),
    );
    const result = await getLowcapCandles({ ...OPTIONS, includeFlat: false });
    expect(result.candles.map((candle) => candle.time)).toEqual([0, 310, 420].map((index) => START + index * MINUTE));
    expect(get).toHaveBeenCalledTimes(3);
    for (const [, config] of get.mock.calls) expect(config?.params.flat_enable).toBe(false);
  });

  it.each(getLowcapSupportedResolutions())(
    "pages %s with at most 200 UTC buckets including the boundary",
    async (resolution) => {
      const start = floorLowcapCandleTime(START, resolution);
      const rows = Array.from({ length: 401 }, (_, index) => bar(shiftLowcapCandleTime(start, resolution, index)));
      serve(rows);
      const result = await getLowcapCandles({
        ...OPTIONS,
        resolution,
        from: start,
        to: shiftLowcapCandleTime(start, resolution, 400),
      });
      expect(result.candles).toHaveLength(400);
      expect(get).toHaveBeenCalledTimes(3);
      for (const [, config] of get.mock.calls) {
        const from = Date.parse(config!.params.from_date);
        expect(Date.parse(config!.params.to_date)).toBeLessThanOrEqual(shiftLowcapCandleTime(from, resolution, 199));
      }
    },
  );

  it("aborts between pages even when an HTTP adapter resolves after cancellation", async () => {
    const controller = new AbortController();
    get.mockImplementation(async () => {
      controller.abort();
      return { data: { result: [] } };
    });
    await expect(getLowcapCandles({ ...OPTIONS, signal: controller.signal })).rejects.toThrow();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("re-fetches a forming bar instead of freezing it", async () => {
    serve([bar(START, 2)]);
    const first = await getLowcapCandles({ ...OPTIONS, to: START + 1 });
    serve([bar(START, 3)]);
    const second = await getLowcapCandles({ ...OPTIONS, to: START + 1 });
    expect(first.candles[0]?.close).toBe(2);
    expect(second.candles[0]?.close).toBe(3);
  });

  it("stops early for a small countBack with flats filtered without relying on page length", async () => {
    serve(
      Array.from({ length: 450 }, (_, index) => bar(START + index * MINUTE, index + 1)),
      false,
    );
    const result = await getLowcapCandles({ ...OPTIONS, includeFlat: false, limit: 3 });
    expect(result.candles.map((candle) => candle.time)).toEqual([447, 448, 449].map((index) => START + index * MINUTE));
    expect(get).toHaveBeenCalledOnce();
    expect(result.noMoreData).toBe(false);
  });

  it("does not satisfy countBack from an artificial first candle at a flat page boundary", async () => {
    serve(
      Array.from({ length: 450 }, (_, index) => bar(START + index * MINUTE, 2, 0)),
      false,
    );
    const result = await getLowcapCandles({ ...OPTIONS, includeFlat: false, limit: 1 });
    expect(result.candles.map((candle) => candle.time)).toEqual([START]);
    expect(get).toHaveBeenCalledTimes(3);
  });
});
