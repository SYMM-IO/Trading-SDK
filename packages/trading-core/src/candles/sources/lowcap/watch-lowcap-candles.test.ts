import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../../shared/test/mock-config";
import type { WatchEnigmaPricesParameters } from "../../../websocket/prices/watch-enigma-prices";
import type { Candle, GetCandlesReturnType } from "../../types";
import { watchLowcapCandles } from "./watch-lowcap-candles";

const watchPrices = vi.hoisted(() => vi.fn());
vi.mock("../../../websocket/prices/watch-enigma-prices", () => ({ watchEnigmaPrices: watchPrices }));
const START = Date.UTC(2026, 10, 1, 12);
const MARKET = "TOKEN::Ab_SFLOW";
const BAR: Candle = { time: START, open: 2, high: 4, low: 1, close: 3, volume: 250 };
let handlers: WatchEnigmaPricesParameters;
const unwatch = vi.fn();

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

function setup(
  getHistory = vi.fn<Parameters<typeof watchLowcapCandles>[1]["getHistory"]>(async () => ({
    candles: [{ ...BAR }],
    noMoreData: false,
  })),
) {
  const onCandle = vi.fn();
  const onReset = vi.fn();
  const onError = vi.fn();
  const stop = watchLowcapCandles(mockConfig().config, {
    marketName: MARKET,
    resolution: "1m",
    includeFlat: true,
    refreshIntervalMs: 30_000,
    resolveAddress: async () => "AbCd",
    getHistory,
    onCandle,
    onReset,
    onError,
  });
  return { stop, getHistory, onCandle, onReset, onError };
}

function tick(price: string, time = Date.now(), name = MARKET, address = "AbCd") {
  handlers.onPrices([{ name, address, time, markPrice: price }]);
}

describe("watchLowcapCandles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START + 20_000);
    unwatch.mockReset();
    watchPrices.mockImplementation((_config, next) => {
      handlers = next;
      return unwatch;
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("seeds the existing candle and updates OHLC without inventing USD volume", async () => {
    const stream = setup();
    await flush();
    tick("5");
    expect(stream.onCandle).toHaveBeenLastCalledWith({ ...BAR, high: 5, close: 5 }, { closed: false });
    stream.stop();
    expect(unwatch).toHaveBeenCalledOnce();
  });

  it("buffers ticks while the HTTP seed is pending and replays them over the complete candle", async () => {
    let resolve!: (value: GetCandlesReturnType) => void;
    const stream = setup(
      vi.fn(
        () =>
          new Promise<GetCandlesReturnType>((done) => {
            resolve = done;
          }),
      ),
    );
    await flush();
    tick("7");
    expect(stream.onCandle).not.toHaveBeenCalled();
    resolve({ candles: [BAR], noMoreData: false });
    await flush();
    expect(stream.onCandle).toHaveBeenLastCalledWith({ ...BAR, high: 7, close: 7 }, { closed: false });
    stream.stop();
  });

  it("closes the previous interval, starts a new candle and leaves real gaps empty", async () => {
    const stream = setup();
    await flush();
    tick("6", START + 180_000);
    expect(stream.onCandle).toHaveBeenNthCalledWith(2, BAR, { closed: true });
    expect(stream.onCandle).toHaveBeenLastCalledWith(
      { time: START + 180_000, open: 6, high: 6, low: 6, close: 6, volume: 0 },
      { closed: false },
    );
    stream.stop();
  });

  it("keeps prices live during a slow refresh and replays them over the corrected snapshot", async () => {
    let resolve!: (value: GetCandlesReturnType) => void;
    const getHistory = vi
      .fn()
      .mockResolvedValueOnce({ candles: [BAR], noMoreData: false })
      .mockImplementationOnce(
        () =>
          new Promise<GetCandlesReturnType>((done) => {
            resolve = done;
          }),
      );
    const stream = setup(getHistory);
    await flush();
    await vi.advanceTimersByTimeAsync(30_000);
    tick("7", Date.now() + 1);
    expect(stream.onCandle.mock.lastCall?.[0]).toMatchObject({ high: 7, close: 7, volume: 250 });
    tick("6", Date.now() + 2);
    resolve({ candles: [{ ...BAR, volume: 400 }], noMoreData: false });
    await flush();
    expect(stream.onCandle.mock.lastCall?.[0]).toMatchObject({ high: 7, close: 6, volume: 400 });
    expect(stream.onError).not.toHaveBeenCalled();
    stream.stop();
  });

  it("ignores collisions, invalid prices and out-of-order source timestamps", async () => {
    const stream = setup();
    await flush();
    tick("6", START + 25_000);
    tick("99", START + 24_000);
    tick("100", START + 26_000, "TOKEN::Other_SFLOW");
    tick("100", START + 26_000, MARKET, "OtherAddress");
    tick("not-a-price", START + 26_000);
    handlers.onPrices([{ name: MARKET, markPrice: "100" }]);
    expect(stream.onCandle).toHaveBeenCalledTimes(2);
    expect(stream.onCandle.mock.lastCall?.[0].close).toBe(6);
    stream.stop();
  });

  it("reconciles authoritative volume and resets history on completed-bar corrections", async () => {
    const older = { ...BAR, time: START - 60_000 };
    const getHistory = vi
      .fn()
      .mockResolvedValueOnce({ candles: [older, BAR], noMoreData: false })
      .mockResolvedValue({
        candles: [
          { ...older, volume: 300 },
          { ...BAR, volume: 400 },
        ],
        noMoreData: false,
      });
    const stream = setup(getHistory);
    await flush();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stream.onCandle.mock.lastCall?.[0].volume).toBe(400);
    expect(stream.onReset).toHaveBeenCalledOnce();
    stream.stop();
  });

  it("asks consumers to reload the retained range hourly even when recent bars are unchanged", async () => {
    const stream = setup();
    await flush();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(stream.onReset).toHaveBeenCalledOnce();
    expect(stream.onReset).toHaveBeenLastCalledWith();
    stream.stop();
  });

  it("does not postpone the full hourly refresh when recent corrections keep arriving", async () => {
    const onReset = vi.fn();
    const stop = watchLowcapCandles(mockConfig().config, {
      marketName: MARKET,
      resolution: "1h",
      includeFlat: true,
      refreshIntervalMs: 600_000,
      resolveAddress: async () => "AbCd",
      getHistory: async (_address, { from }) => ({
        candles: [
          { ...BAR, time: from, volume: Date.now() - START },
          { ...BAR, time: from + 3_600_000 },
        ],
        noMoreData: false,
      }),
      onCandle: vi.fn(),
      onReset,
    });
    await flush();
    await vi.advanceTimersByTimeAsync(3_000_000);
    expect(onReset).toHaveBeenCalledTimes(5);
    expect(onReset.mock.calls.every(([range]) => range.from === START - 3_600_000 && range.to === START)).toBe(true);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(onReset).toHaveBeenCalledTimes(6);
    expect(onReset).toHaveBeenLastCalledWith();
    stop();
  });

  it("retries a failed seed and does not create an incomplete candle from its buffered ticks", async () => {
    const getHistory = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue({ candles: [BAR], noMoreData: false });
    const stream = setup(getHistory);
    await flush();
    tick("5");
    expect(stream.onError).toHaveBeenCalledOnce();
    expect(stream.onCandle).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stream.onCandle.mock.lastCall?.[0]).toMatchObject({ open: 2, high: 4, low: 1, close: 3 });
    tick("99", START + 19_000);
    expect(stream.onCandle).toHaveBeenCalledOnce();
    stream.stop();
  });

  it("aborts in-flight history and drops late callbacks after unsubscribe", async () => {
    let resolve!: (value: GetCandlesReturnType) => void;
    const getHistory = vi.fn<Parameters<typeof watchLowcapCandles>[1]["getHistory"]>(
      () =>
        new Promise<GetCandlesReturnType>((done) => {
          resolve = done;
        }),
    );
    const stream = setup(getHistory);
    await flush();
    stream.stop();
    expect(getHistory.mock.calls[0]?.[1].signal.aborted).toBe(true);
    resolve({ candles: [BAR], noMoreData: false });
    tick("9");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(stream.onCandle).not.toHaveBeenCalled();
    expect(getHistory).toHaveBeenCalledOnce();
  });

  it("keeps server-timestamped prices live when the computer clock is ahead", async () => {
    vi.setSystemTime(START + 80_000);
    const stream = setup();
    await flush();
    tick("5", START + 20_000);
    expect(stream.onCandle.mock.lastCall?.[0].close).toBe(5);
    expect(stream.onCandle.mock.lastCall?.[1].closed).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    tick("6", START + 50_000);
    expect(stream.onCandle.mock.lastCall?.[0].close).toBe(6);
    stream.stop();
  });

  it("does not reset on rollover when the chart already received the completed OHLCV", async () => {
    vi.setSystemTime(START + 50_000);
    const completed = { ...BAR, high: 5, close: 5 };
    const next = { ...BAR, time: START + 60_000, open: 6, high: 6, low: 6, close: 6, volume: 0 };
    const history = vi
      .fn()
      .mockResolvedValueOnce({ candles: [BAR], noMoreData: false })
      .mockResolvedValue({ candles: [completed, next], noMoreData: false });
    const stream = setup(history);
    await flush();
    tick("5", START + 55_000);
    tick("6", START + 65_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stream.onReset).not.toHaveBeenCalled();
    history.mockResolvedValue({ candles: [{ ...completed, volume: 300 }, next], noMoreData: false });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stream.onReset).toHaveBeenCalledOnce();
    expect(stream.onReset).toHaveBeenLastCalledWith({ from: START, to: START + 60_000 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stream.onReset).toHaveBeenCalledOnce();
    stream.stop();
  });

  it("reseeds after reconnect and prevents an aborted older request from overwriting fresh data", async () => {
    let resolve!: (value: GetCandlesReturnType) => void;
    const getHistory = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<GetCandlesReturnType>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue({ candles: [{ ...BAR, high: 6, close: 6 }], noMoreData: false });
    const stream = setup(getHistory);
    await flush();
    handlers.onStatusChange?.("open");
    handlers.onStatusChange?.("reconnecting");
    handlers.onStatusChange?.("open");
    await flush();
    resolve({ candles: [BAR], noMoreData: false });
    await flush();
    expect(stream.onReset).toHaveBeenCalledOnce();
    expect(stream.onCandle).toHaveBeenCalledOnce();
    expect(stream.onCandle.mock.lastCall?.[0].close).toBe(6);
    stream.stop();
  });
});
