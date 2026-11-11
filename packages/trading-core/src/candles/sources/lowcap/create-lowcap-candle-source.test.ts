import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../../shared/test/mock-config";
import { toTradingViewDatafeed } from "../../adapters/tradingview/to-tradingview-datafeed";
import type {
  TradingViewBar,
  TradingViewHistoryMetadata,
  TradingViewSymbolInfo,
} from "../../adapters/tradingview/types";
import { createLowcapCandleSource } from "./create-lowcap-candle-source";

const get = vi.spyOn(axios, "get");
const MARKET = "TOKEN::Ab_SFLOW";
const TIME = Date.UTC(2026, 10, 1);

describe("createLowcapCandleSource", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(async (url) => ({
      data:
        url === "/api/v1/symbols/info"
          ? [
              { name: "TOKEN::Other_SFLOW", address: "Other", status: "ACTIVE" },
              { name: MARKET, address: "AbCd", status: "ACTIVE" },
            ]
          : { result: [{ timestamp: TIME / 1000, open: 1, high: 2, low: 1, close: 2, volume: 15 }], has_older: false },
    }));
  });

  it("resolves the complete market name without ticker or address-case collisions", async () => {
    const source = createLowcapCandleSource(mockConfig().config);
    expect(await source.getSymbol("TOKEN")).toBeUndefined();
    expect(await source.getSymbol(MARKET)).toMatchObject({
      sourceSymbol: "AbCd",
      volumeUnit: "quote",
      volumeCurrency: "USD",
    });
    await source.getCandles({ marketName: MARKET, resolution: "1m", from: TIME, to: TIME + 60_000 });
    expect(get).toHaveBeenCalledWith(
      "/api/v1/prices/AbCd/ohlcv",
      expect.objectContaining({ params: expect.objectContaining({ flat_enable: false, version: 2 }) }),
    );
  });

  it("separates flat policies in history query identities", () => {
    const { config } = mockConfig();
    expect(createLowcapCandleSource(config).id).not.toBe(createLowcapCandleSource(config, { includeFlat: true }).id);
    expect(createLowcapCandleSource(config).id).toBe(createLowcapCandleSource(config, { includeFlat: false }).id);
  });

  it("reports unsupported deployments through source operations, allowing React to render query errors", async () => {
    const source = createLowcapCandleSource(mockConfig().config, { chainId: 999999 });
    await expect(
      source.getCandles({ marketName: MARKET, resolution: "1h", from: TIME, to: TIME + 1 }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CHAIN" });
    expect(() => source.watchCandles?.({ marketName: MARKET, resolution: "1h", onCandle: vi.fn() })).toThrow();
    expect(get).not.toHaveBeenCalled();
  });

  it("reuses listings across timeframe changes without caching candle history", async () => {
    const source = createLowcapCandleSource(mockConfig().config);
    for (const resolution of ["1m", "5m", "1m"] as const) {
      await source.getCandles({ marketName: MARKET, resolution, from: TIME, to: TIME + 1 });
    }
    expect(get.mock.calls.filter(([url]) => url === "/api/v1/symbols/info")).toHaveLength(1);
    expect(get.mock.calls.filter(([url]) => url.endsWith("/ohlcv"))).toHaveLength(3);
  });

  it("works with the existing TradingView adapter and preserves full market names", async () => {
    const datafeed = toTradingViewDatafeed(createLowcapCandleSource(mockConfig().config));
    const symbol = await new Promise<TradingViewSymbolInfo>((resolve, reject) =>
      datafeed.resolveSymbol(MARKET, resolve, reject),
    );
    const result = await new Promise<{ bars: TradingViewBar[]; metadata: TradingViewHistoryMetadata }>(
      (resolve, reject) => {
        datafeed.getBars(
          symbol,
          "1",
          { from: TIME / 1000, to: TIME / 1000 + 60, countBack: 1, firstDataRequest: true },
          (bars, metadata) => resolve({ bars, metadata }),
          reject,
        );
      },
    );
    expect(result.bars).toEqual([{ time: TIME, open: 1, high: 2, low: 1, close: 2, volume: 15 }]);
    expect(result.metadata.noData).toBe(true);
  });
});
