import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { createFakeWebSocket } from "../../../shared/test/fake-web-socket";
import type { Candle } from "../../types";
import type { BinanceSymbolInfo } from "./fetch-binance-exchange-info";

const fetchKlines = vi.hoisted(() => vi.fn());
const fetchExchangeInfo = vi.hoisted(() => vi.fn());

vi.mock("./fetch-binance-klines", () => ({ fetchBinanceKlines: fetchKlines }));
vi.mock("./fetch-binance-exchange-info", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fetch-binance-exchange-info")>();
  return { ...actual, fetchBinanceExchangeInfo: fetchExchangeInfo };
});

import { createBinanceCandleSource } from "./create-binance-candle-source";

const MINUTE = 60_000;
const TO = 3_000_000_000_000;

/** Build `count` ascending 1m bars whose newest bar opens at `endExclusive - MINUTE`. */
function makeCandles(count: number, endExclusive: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const time = endExclusive - (count - index) * MINUTE;
    return { time, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 };
  });
}

const BTC_INFO: BinanceSymbolInfo = {
  symbol: "BTCUSDT",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  pricePrecision: 2,
};

describe("createBinanceCandleSource", () => {
  beforeEach(() => {
    fetchKlines.mockReset();
    fetchExchangeInfo.mockReset();
    fetchExchangeInfo.mockResolvedValue(new Map([["BTCUSDT", BTC_INFO]]));
  });

  it("dials the futures `/market/` stream, the only form that actually pushes frames", () => {
    const fake = createFakeWebSocket();
    const source = createBinanceCandleSource({ webSocketConstructor: fake.WebSocket });

    const unwatch = source.watchCandles!({ marketName: "BTCUSDT", resolution: "1m", onCandle: () => {} });

    /**
     * `wss://fstream.binance.com/stream` and `/ws` both connect and acknowledge
     * the SUBSCRIBE, then never deliver a kline. Losing the `/market/` prefix
     * therefore breaks the live chart with no error anywhere — hence this test.
     */
    expect(fake.last().url).toBe("wss://fstream.binance.com/market/stream");
    unwatch();
  });

  it("describes itself as a reference-exchange source", () => {
    const source = createBinanceCandleSource();
    expect(source.id).toBe("binance:usd-m-futures");
    expect(source.priceBasis).toBe("reference-exchange");
    expect(source.maxCandlesPerRequest).toBe(1500);
  });

  it("never sends startTime — Binance caps a bounded range from its start, which returns the wrong end for a chart", async () => {
    fetchKlines.mockResolvedValue(makeCandles(10, TO));
    const source = createBinanceCandleSource();

    await source.getCandles({ marketName: "BTCUSDT", resolution: "1m", from: 0, to: TO, limit: 10 });

    expect(fetchKlines).toHaveBeenCalledTimes(1);
    expect(fetchKlines.mock.calls[0]?.[0]).toMatchObject({ endTime: TO - 1, limit: 10 });
    expect(fetchKlines.mock.calls[0]?.[0].startTime).toBeUndefined();
  });

  it("pages backwards from `to`, capping each request at the venue limit", async () => {
    const firstPage = makeCandles(1500, TO);
    const secondPage = makeCandles(1000, firstPage[0]!.time);
    fetchKlines.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    const source = createBinanceCandleSource();
    const result = await source.getCandles({
      marketName: "BTCUSDT",
      resolution: "1m",
      from: 0,
      to: TO,
      limit: 2500,
    });

    expect(fetchKlines).toHaveBeenCalledTimes(2);
    expect(fetchKlines.mock.calls[0]?.[0]).toMatchObject({ endTime: TO - 1, limit: 1500 });
    /** Second page ends just before the oldest bar already collected — no overlap, no gap. */
    expect(fetchKlines.mock.calls[1]?.[0]).toMatchObject({
      endTime: firstPage[0]!.time - 1,
      limit: 1000,
    });

    expect(result.candles).toHaveLength(2500);
    expect(result.candles[0]?.time).toBe(secondPage[0]!.time);
    expect(result.candles.at(-1)?.time).toBe(TO - MINUTE);
    expect(result.noMoreData).toBe(false);
  });

  it("returns bars in ascending time order across pages", async () => {
    const firstPage = makeCandles(1500, TO);
    const secondPage = makeCandles(1000, firstPage[0]!.time);
    fetchKlines.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    const source = createBinanceCandleSource();
    const { candles } = await source.getCandles({
      marketName: "BTCUSDT",
      resolution: "1m",
      from: 0,
      to: TO,
      limit: 2500,
    });

    for (let index = 1; index < candles.length; index++) {
      expect(candles[index]!.time).toBeGreaterThan(candles[index - 1]!.time);
    }
  });

  it("clips bars outside the requested range", async () => {
    const from = TO - 5 * MINUTE;
    /** The venue returns 10 bars; only the 5 at or after `from` belong in the result. */
    fetchKlines.mockResolvedValue(makeCandles(10, TO));

    const source = createBinanceCandleSource();
    const { candles } = await source.getCandles({ marketName: "BTCUSDT", resolution: "1m", from, to: TO });

    expect(candles).toHaveLength(5);
    expect(candles.every((candle) => candle.time >= from && candle.time < TO)).toBe(true);
  });

  it("stops paging once the venue returns a short batch", async () => {
    fetchKlines.mockResolvedValueOnce(makeCandles(3, TO));

    const source = createBinanceCandleSource();
    const { candles } = await source.getCandles({
      marketName: "BTCUSDT",
      resolution: "1m",
      from: 0,
      to: TO,
      limit: 1000,
    });

    expect(fetchKlines).toHaveBeenCalledTimes(1);
    expect(candles).toHaveLength(3);
  });

  it("reports noMoreData when the venue has nothing in the window", async () => {
    fetchKlines.mockResolvedValue([]);

    const source = createBinanceCandleSource();
    const result = await source.getCandles({ marketName: "BTCUSDT", resolution: "1m", from: 0, to: TO });

    expect(result.candles).toHaveLength(0);
    expect(result.noMoreData).toBe(true);
  });

  it("rejects a resolution the market has no interval for", async () => {
    const source = createBinanceCandleSource();
    await expect(source.getCandles({ marketName: "BTCUSDT", resolution: "10s", from: 0, to: TO })).rejects.toThrow(
      SymmError,
    );
  });

  it("resolves symbol metadata and caches exchangeInfo across calls", async () => {
    const source = createBinanceCandleSource();

    const first = await source.getSymbol("BTCUSDT");
    const second = await source.getSymbol("BTCUSDT");

    expect(fetchExchangeInfo).toHaveBeenCalledTimes(1);
    expect(first).toEqual({
      marketName: "BTCUSDT",
      sourceSymbol: "BTCUSDT",
      description: "BTC / USDT",
      pricePrecision: 2,
      volumePrecision: 2,
    });
    expect(second).toEqual(first);
  });

  it("refetches exchangeInfo after a failure rather than caching the rejection", async () => {
    fetchExchangeInfo
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Map([["BTCUSDT", BTC_INFO]]));
    const source = createBinanceCandleSource();

    await expect(source.getSymbol("BTCUSDT")).rejects.toThrow("network");
    await expect(source.getSymbol("BTCUSDT")).resolves.toMatchObject({ sourceSymbol: "BTCUSDT" });
    expect(fetchExchangeInfo).toHaveBeenCalledTimes(2);
  });

  it("returns undefined for a market the venue does not list", async () => {
    const source = createBinanceCandleSource();
    await expect(source.getSymbol("NOTLISTED")).resolves.toBeUndefined();
  });

  it("returns undefined when the symbol mapping declines a market", async () => {
    const source = createBinanceCandleSource({ resolveSymbol: () => undefined });
    await expect(source.getSymbol("BTCUSDT")).resolves.toBeUndefined();
  });

  it("honors a custom symbol mapping when fetching", async () => {
    fetchKlines.mockResolvedValue(makeCandles(1, TO));
    const source = createBinanceCandleSource({ resolveSymbol: (name) => `${name}PERP` });

    await source.getCandles({ marketName: "BTC", resolution: "1m", from: 0, to: TO });

    expect(fetchKlines.mock.calls[0]?.[0]).toMatchObject({ symbol: "BTCPERP" });
  });

  it("routes requests at the spot endpoints when the spot market is selected", async () => {
    fetchKlines.mockResolvedValue(makeCandles(1, TO));
    const source = createBinanceCandleSource({ market: "spot" });

    expect(source.id).toBe("binance:spot");
    expect(source.maxCandlesPerRequest).toBe(1000);

    await source.getCandles({ marketName: "BTCUSDT", resolution: "1s", from: 0, to: TO });
    expect(fetchKlines.mock.calls[0]?.[0]).toMatchObject({
      market: "spot",
      interval: "1s",
      restUrl: "https://api.binance.com",
    });
  });
});
