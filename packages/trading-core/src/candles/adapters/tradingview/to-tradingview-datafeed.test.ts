import { describe, expect, it, vi } from "vitest";
import type { CandleSource, GetCandlesParameters, WatchCandlesParameters } from "../../types";
import { toTradingViewDatafeed } from "./to-tradingview-datafeed";
import type { TradingViewBar, TradingViewDatafeedConfiguration, TradingViewSymbolInfo } from "./types";

const MINUTE = 60_000;

function createStubSource(overrides: Partial<CandleSource> = {}): CandleSource {
  return {
    id: "stub",
    priceBasis: "reference-exchange",
    supportedResolutions: ["1m", "1h", "1d"],
    maxCandlesPerRequest: 1000,
    getSymbol: vi.fn(async (marketName: string) =>
      marketName === "BTCUSDT"
        ? {
            marketName,
            sourceSymbol: marketName,
            description: "BTC / USDT",
            pricePrecision: 2,
            volumePrecision: 2,
          }
        : undefined,
    ),
    getCandles: vi.fn(async () => ({ candles: [], noMoreData: true })),
    watchCandles: vi.fn(() => () => {}),
    ...overrides,
  };
}

const SYMBOL_INFO = { name: "BTCUSDT" } as TradingViewSymbolInfo;

describe("toTradingViewDatafeed", () => {
  it("reports its resolutions in TradingView's vocabulary, asynchronously", async () => {
    const datafeed = toTradingViewDatafeed(createStubSource());
    const configuration = await new Promise<TradingViewDatafeedConfiguration>((resolve) => datafeed.onReady(resolve));

    expect(configuration.supported_resolutions).toEqual(["1", "60", "1D"]);
    expect(configuration.supports_search).toBe(false);
  });

  it("resolves symbol info with a pricescale derived from precision", async () => {
    const datafeed = toTradingViewDatafeed(createStubSource(), { exchange: "Binance" });
    const info = await new Promise<TradingViewSymbolInfo>((resolve, reject) =>
      datafeed.resolveSymbol("Binance:BTCUSDT", resolve, reject),
    );

    expect(info.name).toBe("BTCUSDT");
    expect(info.pricescale).toBe(100);
    expect(info.minmov).toBe(1);
    expect(info.exchange).toBe("Binance");
    expect(info.session).toBe("24x7");
    expect(info.timezone).toBe("Etc/UTC");
    expect(info.data_status).toBe("streaming");
  });

  it("errors for a symbol the source does not carry", async () => {
    const datafeed = toTradingViewDatafeed(createStubSource());
    const reason = await new Promise<string>((resolve) =>
      datafeed.resolveSymbol("NOPE", () => resolve("resolved"), resolve),
    );

    expect(reason).toMatch(/Unknown symbol/);
  });

  it("converts second-based period params to milliseconds", async () => {
    const source = createStubSource();
    const datafeed = toTradingViewDatafeed(source);

    await new Promise<void>((resolve) =>
      datafeed.getBars(
        SYMBOL_INFO,
        "1",
        { from: 1_700_000_000, to: 1_700_003_600, firstDataRequest: true, countBack: 10 },
        () => resolve(),
        () => resolve(),
      ),
    );

    const params = (source.getCandles as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as GetCandlesParameters;
    expect(params.to).toBe(1_700_003_600_000);
    expect(params.resolution).toBe("1m");
    expect(params.limit).toBe(10);
  });

  it("widens `from` so a short window still satisfies countBack", async () => {
    const source = createStubSource();
    const datafeed = toTradingViewDatafeed(source);

    /** A one-minute window, but the chart asks for 500 one-minute bars. */
    const to = 1_700_003_600;
    await new Promise<void>((resolve) =>
      datafeed.getBars(
        SYMBOL_INFO,
        "1",
        { from: to - 60, to, firstDataRequest: true, countBack: 500 },
        () => resolve(),
        () => resolve(),
      ),
    );

    const params = (source.getCandles as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as GetCandlesParameters;
    expect(params.from).toBe(to * 1000 - 500 * MINUTE);
  });

  it("forwards noMoreData as the library's noData flag", async () => {
    const source = createStubSource({
      getCandles: vi.fn(async () => ({
        candles: [{ time: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3 }],
        noMoreData: false,
      })),
    });
    const datafeed = toTradingViewDatafeed(source);

    const result = await new Promise<{ bars: TradingViewBar[]; noData: boolean }>((resolve, reject) =>
      datafeed.getBars(
        SYMBOL_INFO,
        "1",
        { from: 1_700_000_000, to: 1_700_003_600, firstDataRequest: true, countBack: 10 },
        (bars, meta) => resolve({ bars, noData: meta.noData }),
        reject,
      ),
    );

    expect(result.noData).toBe(false);
    expect(result.bars[0]).toEqual({
      time: 1_700_000_000_000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 3,
    });
  });

  it("errors for an unrecognized resolution code", async () => {
    const datafeed = toTradingViewDatafeed(createStubSource());
    const reason = await new Promise<string>((resolve) =>
      datafeed.getBars(
        SYMBOL_INFO,
        "7",
        { from: 0, to: 1, firstDataRequest: true, countBack: 1 },
        () => resolve("ok"),
        resolve,
      ),
    );

    expect(reason).toMatch(/Unsupported resolution/);
  });

  it("wires the library's cache reset to the source's reconnect signal", () => {
    let triggerReset = () => {};
    const source = createStubSource({
      watchCandles: vi.fn((parameters: WatchCandlesParameters) => {
        triggerReset = () => parameters.onReset?.();
        return () => {};
      }),
    });
    const datafeed = toTradingViewDatafeed(source);
    const onResetCacheNeeded = vi.fn();

    datafeed.subscribeBars(SYMBOL_INFO, "1", vi.fn(), "guid-1", onResetCacheNeeded);
    triggerReset();

    expect(onResetCacheNeeded).toHaveBeenCalledTimes(1);
  });

  it("releases the subscription on unsubscribe", () => {
    const unwatch = vi.fn();
    const source = createStubSource({ watchCandles: vi.fn(() => unwatch) });
    const datafeed = toTradingViewDatafeed(source);

    datafeed.subscribeBars(SYMBOL_INFO, "1", vi.fn(), "guid-1", vi.fn());
    datafeed.unsubscribeBars("guid-1");

    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("releases a stale subscription when the library reuses a guid", () => {
    const unwatch = vi.fn();
    const source = createStubSource({ watchCandles: vi.fn(() => unwatch) });
    const datafeed = toTradingViewDatafeed(source);

    datafeed.subscribeBars(SYMBOL_INFO, "1", vi.fn(), "guid-1", vi.fn());
    datafeed.subscribeBars(SYMBOL_INFO, "60", vi.fn(), "guid-1", vi.fn());

    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("reports endofday when the source has no live feed", async () => {
    const source = createStubSource();
    delete (source as { watchCandles?: unknown }).watchCandles;
    const datafeed = toTradingViewDatafeed(source);

    const info = await new Promise<TradingViewSymbolInfo>((resolve, reject) =>
      datafeed.resolveSymbol("BTCUSDT", resolve, reject),
    );

    expect(info.data_status).toBe("endofday");
  });
});
