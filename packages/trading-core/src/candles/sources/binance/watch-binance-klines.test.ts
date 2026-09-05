import { describe, expect, it, vi } from "vitest";
import { createFakeWebSocket } from "../../../shared/test/fake-web-socket";
import type { SocketStatus } from "../../../websocket/socket";
import type { Candle, CandleUpdateMeta } from "../../types";
import { watchBinanceKlines } from "./watch-binance-klines";

function klineFrame(symbol: string, interval: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    stream: `${symbol.toLowerCase()}@kline_${interval}`,
    data: {
      e: "kline",
      s: symbol,
      k: { t: 1_700_000_000_000, i: interval, o: "1", h: "2", l: "0.5", c: "1.5", v: "10", x: false, ...overrides },
    },
  };
}

function setup(symbol = "BTCUSDT", interval = "1m") {
  const fake = createFakeWebSocket();
  const candles: { candle: Candle; meta: CandleUpdateMeta }[] = [];
  const statuses: SocketStatus[] = [];
  let resets = 0;

  const unwatch = watchBinanceKlines({
    wsUrl: "wss://fstream.binance.com/stream",
    symbol,
    interval,
    webSocketConstructor: fake.WebSocket,
    onCandle: (candle, meta) => candles.push({ candle, meta }),
    onReset: () => resets++,
    onStatusChange: (status) => statuses.push(status),
  });

  return { fake, candles, statuses, unwatch, getResets: () => resets };
}

describe("watchBinanceKlines", () => {
  it("subscribes to the symbol+interval stream on open", () => {
    const { fake, unwatch } = setup();
    fake.last().simulateOpen();

    expect(fake.last().sent).toHaveLength(1);
    expect(JSON.parse(fake.last().sent[0]!)).toEqual({
      method: "SUBSCRIBE",
      params: ["btcusdt@kline_1m"],
      id: 1,
    });

    unwatch();
  });

  it("delivers normalized bars with their closed flag", () => {
    const { fake, candles, unwatch } = setup();
    fake.last().simulateOpen();

    fake.last().simulateMessage(klineFrame("BTCUSDT", "1m"));
    fake.last().simulateMessage(klineFrame("BTCUSDT", "1m", { x: true, c: "1.75" }));

    expect(candles).toHaveLength(2);
    expect(candles[0]?.candle).toEqual({
      time: 1_700_000_000_000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 10,
    });
    expect(candles[0]?.meta.closed).toBe(false);
    expect(candles[1]?.meta.closed).toBe(true);
    expect(candles[1]?.candle.close).toBe(1.75);

    unwatch();
  });

  it("ignores frames for another symbol", () => {
    const { fake, candles, unwatch } = setup("BTCUSDT", "1m");
    fake.last().simulateOpen();

    fake.last().simulateMessage(klineFrame("ETHUSDT", "1m"));

    expect(candles).toHaveLength(0);
    unwatch();
  });

  it("ignores frames for another interval, so two charts never cross-feed", () => {
    const { fake, candles, unwatch } = setup("BTCUSDT", "1m");
    fake.last().simulateOpen();

    fake.last().simulateMessage(klineFrame("BTCUSDT", "5m"));

    expect(candles).toHaveLength(0);
    unwatch();
  });

  it("ignores non-kline control frames", () => {
    const { fake, candles, unwatch } = setup();
    fake.last().simulateOpen();

    fake.last().simulateMessage({ result: null, id: 1 });
    fake.last().simulateMessage({ stream: "btcusdt@aggTrade", data: { e: "aggTrade", s: "BTCUSDT" } });

    expect(candles).toHaveLength(0);
    unwatch();
  });

  it("accepts raw (non-combined) stream frames too", () => {
    const { fake, candles, unwatch } = setup();
    fake.last().simulateOpen();

    fake.last().simulateMessage({
      e: "kline",
      s: "BTCUSDT",
      k: { t: 1_700_000_000_000, i: "1m", o: "1", h: "2", l: "0.5", c: "1.5", v: "10", x: false },
    });

    expect(candles).toHaveLength(1);
    unwatch();
  });

  it("does not fire onReset on the first open", () => {
    const { fake, getResets, unwatch } = setup();
    fake.last().simulateOpen();

    expect(getResets()).toBe(0);
    unwatch();
  });

  it("fires onReset after a reconnect, since bars were missed in the gap", () => {
    vi.useFakeTimers();
    try {
      const { fake, getResets, unwatch } = setup();
      fake.last().simulateOpen();
      fake.last().simulateClose();

      /** Reconnects are scheduled behind exponential backoff, so the dial is a timer away. */
      vi.advanceTimersByTime(5_000);
      expect(fake.instances).toHaveLength(2);

      fake.last().simulateOpen();
      expect(getResets()).toBe(1);

      /** The re-dialed socket resubscribes on its own, without consumer involvement. */
      expect(JSON.parse(fake.last().sent[0]!)).toMatchObject({ params: ["btcusdt@kline_1m"] });

      unwatch();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports parse failures without tearing down the subscription", () => {
    const fake = createFakeWebSocket();
    const errors: unknown[] = [];
    const candles: Candle[] = [];

    const unwatch = watchBinanceKlines({
      wsUrl: "wss://fstream.binance.com/stream",
      symbol: "BTCUSDT",
      interval: "1m",
      webSocketConstructor: fake.WebSocket,
      onCandle: (candle) => candles.push(candle),
      onError: (err) => errors.push(err),
    });

    fake.last().simulateOpen();
    fake.last().simulateMessage("not json");
    expect(errors).toHaveLength(1);

    fake.last().simulateMessage(klineFrame("BTCUSDT", "1m"));
    expect(candles).toHaveLength(1);

    unwatch();
  });
});
