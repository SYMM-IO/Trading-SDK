import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { createFakeWebSocket } from "../../../shared/test/fake-web-socket";
import { BINANCE_DEPTH_WS_URL } from "./constants";
import type { BinanceSymbolFilters } from "./fetch-binance-symbol-filters";

const fetchDepth = vi.hoisted(() => vi.fn());
const fetchFilters = vi.hoisted(() => vi.fn());
const watchDepth = vi.hoisted(() => vi.fn());

vi.mock("./fetch-binance-depth", () => ({ fetchBinanceDepth: fetchDepth }));
vi.mock("./fetch-binance-symbol-filters", () => ({ fetchBinanceSymbolFilters: fetchFilters }));
vi.mock("./watch-binance-depth", () => ({ watchBinanceDepth: watchDepth }));

import { createBinanceOrderbookSource } from "./create-binance-orderbook-source";

const BTC_FILTERS: BinanceSymbolFilters = {
  symbol: "BTCUSDT",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  tickSize: 0.1,
  stepSize: 0.001,
  pricePrecision: 1,
  sizePrecision: 3,
};

beforeEach(() => {
  fetchDepth.mockReset().mockResolvedValue({
    marketName: "BTCUSDT",
    bids: [],
    asks: [],
    lastUpdateId: 1,
    timestamp: 0,
  });
  fetchFilters.mockReset().mockResolvedValue(new Map([["BTCUSDT", BTC_FILTERS]]));
  watchDepth.mockReset().mockReturnValue(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createBinanceOrderbookSource — identity", () => {
  it("namespaces its id by market and declares what its prices represent", () => {
    expect(createBinanceOrderbookSource().id).toBe("binance:usd-m-futures");
    expect(createBinanceOrderbookSource({ market: "spot" }).id).toBe("binance:spot");
    expect(createBinanceOrderbookSource().priceBasis).toBe("reference-exchange");
  });

  it("reports the depths each market actually accepts", () => {
    expect(createBinanceOrderbookSource().supportedLimits).toEqual([5, 10, 20, 50, 100, 500, 1000]);
    expect(createBinanceOrderbookSource({ market: "spot" }).supportedLimits).toContain(5000);
    expect(createBinanceOrderbookSource().defaultLimit).toBe(1000);
  });

  it("defaults futures to the depth-carrying WebSocket route", () => {
    /**
     * Regression guard. Binance routes futures streams by class: depth is only
     * served on `/public`, while `/market` carries klines. A depth subscription
     * on the wrong route is acknowledged and then never delivers a frame, so the
     * book would report `open` and stay empty forever.
     */
    expect(BINANCE_DEPTH_WS_URL["usd-m-futures"]).toBe("wss://fstream.binance.com/public/stream");
    expect(BINANCE_DEPTH_WS_URL["usd-m-futures"]).not.toContain("/market/");

    /**
     * The socket is injected because the route, not the runtime, is what this
     * asserts — and `globalThis.WebSocket` only exists from Node 22 on, so
     * leaning on it would fail on the Node 20 floor this package supports.
     */
    const fake = createFakeWebSocket();
    createBinanceOrderbookSource({ webSocketConstructor: fake.WebSocket }).watchOrderbook!({
      marketName: "BTCUSDT",
      onOrderbook: () => {},
    });

    expect(watchDepth).toHaveBeenCalledWith(
      expect.objectContaining({ wsUrl: "wss://fstream.binance.com/public/stream" }),
    );
  });

  it("rejects an update speed the market does not serve, at construction time", () => {
    expect(() => createBinanceOrderbookSource({ updateSpeed: 1000 })).toThrow(SymmError);
    expect(() => createBinanceOrderbookSource({ updateSpeed: 1000 })).toThrow(/no 1000ms depth stream/);
    /** Spot serves 1000ms but not 500ms — the tables are not interchangeable. */
    expect(() => createBinanceOrderbookSource({ market: "spot", updateSpeed: 500 })).toThrow(SymmError);
    expect(() => createBinanceOrderbookSource({ market: "spot", updateSpeed: 1000 })).not.toThrow();
  });
});

describe("createBinanceOrderbookSource — getSymbol", () => {
  it("maps the venue's filters onto symbol metadata", async () => {
    await expect(createBinanceOrderbookSource().getSymbol("BTCUSDT")).resolves.toEqual({
      marketName: "BTCUSDT",
      sourceSymbol: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      pricePrecision: 1,
      sizePrecision: 3,
      tickSize: 0.1,
    });
  });

  it("returns undefined for a market the venue does not list", async () => {
    await expect(createBinanceOrderbookSource().getSymbol("NOTREAL")).resolves.toBeUndefined();
  });

  it("returns undefined without a request when the mapping declines the market", async () => {
    const source = createBinanceOrderbookSource({ resolveSymbol: () => undefined });

    await expect(source.getSymbol("LOWCAP")).resolves.toBeUndefined();
    expect(fetchFilters).not.toHaveBeenCalled();
  });

  it("fetches exchangeInfo once and shares it across concurrent callers", async () => {
    const source = createBinanceOrderbookSource();

    await Promise.all([source.getSymbol("BTCUSDT"), source.getSymbol("BTCUSDT"), source.getSymbol("ETHUSDT")]);

    expect(fetchFilters).toHaveBeenCalledTimes(1);
  });

  it("clears the cache after a failure so a transient error does not poison the source", async () => {
    fetchFilters.mockRejectedValueOnce(new SymmError("api", "BOOM", "down"));
    const source = createBinanceOrderbookSource();

    await expect(source.getSymbol("BTCUSDT")).rejects.toThrow(SymmError);
    await expect(source.getSymbol("BTCUSDT")).resolves.toMatchObject({ sourceSymbol: "BTCUSDT" });
    expect(fetchFilters).toHaveBeenCalledTimes(2);
  });

  it("upper-cases a lower-case market name before looking it up", async () => {
    await expect(createBinanceOrderbookSource().getSymbol("btcusdt")).resolves.toMatchObject({
      sourceSymbol: "BTCUSDT",
    });
  });
});

describe("createBinanceOrderbookSource — getOrderbook", () => {
  it("passes the resolved symbol and depth through", async () => {
    await createBinanceOrderbookSource().getOrderbook({ marketName: "btcusdt", limit: 20 });

    expect(fetchDepth).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BTCUSDT", marketName: "btcusdt", limit: 20, market: "usd-m-futures" }),
    );
  });

  it("falls back to the market's default depth", async () => {
    await createBinanceOrderbookSource().getOrderbook({ marketName: "BTCUSDT" });

    expect(fetchDepth).toHaveBeenCalledWith(expect.objectContaining({ limit: 1000 }));
  });

  it("rejects a depth the venue would refuse outright", async () => {
    /** Futures takes an enum, not a range — an unlisted value is a hard `-4021`. */
    await expect(createBinanceOrderbookSource().getOrderbook({ marketName: "BTCUSDT", limit: 8 })).rejects.toThrow(
      /rejects a depth limit of 8/,
    );
    expect(fetchDepth).not.toHaveBeenCalled();
  });

  it("fails with a typed error for an unmapped market", async () => {
    const source = createBinanceOrderbookSource({ resolveSymbol: () => undefined });

    await expect(source.getOrderbook({ marketName: "LOWCAP" })).rejects.toThrow(/No Binance symbol is mapped/);
  });

  it("honours endpoint overrides, for a proxy or a regional mirror", async () => {
    const source = createBinanceOrderbookSource({ restUrl: "https://proxy.example" });
    await source.getOrderbook({ marketName: "BTCUSDT" });

    expect(fetchDepth).toHaveBeenCalledWith(expect.objectContaining({ restUrl: "https://proxy.example" }));
  });
});

describe("createBinanceOrderbookSource — watchOrderbook", () => {
  it("forwards the whole subscription down to the watcher", () => {
    const fake = createFakeWebSocket();
    const source = createBinanceOrderbookSource({ webSocketConstructor: fake.WebSocket, updateSpeed: 100 });
    const onOrderbook = () => {};

    source.watchOrderbook!({ marketName: "btcusdt", limit: 100, levels: 15, onOrderbook });

    expect(watchDepth).toHaveBeenCalledWith(
      expect.objectContaining({
        market: "usd-m-futures",
        symbol: "BTCUSDT",
        marketName: "btcusdt",
        limit: 100,
        levels: 15,
        updateSpeed: 100,
        webSocketConstructor: fake.WebSocket,
        onOrderbook,
      }),
    );
  });

  it("defaults the emitted level count rather than flooding the consumer", () => {
    const fake = createFakeWebSocket();
    createBinanceOrderbookSource({ webSocketConstructor: fake.WebSocket }).watchOrderbook!({
      marketName: "BTCUSDT",
      onOrderbook: () => {},
    });

    expect(watchDepth).toHaveBeenCalledWith(expect.objectContaining({ levels: 50 }));
  });

  it("returns the watcher's unwatch function", () => {
    const unwatch = vi.fn();
    watchDepth.mockReturnValue(unwatch);
    const fake = createFakeWebSocket();

    const release = createBinanceOrderbookSource({ webSocketConstructor: fake.WebSocket }).watchOrderbook!({
      marketName: "BTCUSDT",
      onOrderbook: () => {},
    });
    release();

    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("validates the depth before dialing", () => {
    const fake = createFakeWebSocket();
    const source = createBinanceOrderbookSource({ webSocketConstructor: fake.WebSocket });

    expect(() => source.watchOrderbook!({ marketName: "BTCUSDT", limit: 7, onOrderbook: () => {} })).toThrow(
      /rejects a depth limit of 7/,
    );
    expect(watchDepth).not.toHaveBeenCalled();
  });

  it("explains how to supply a WebSocket when the runtime has none", () => {
    const original = (globalThis as { WebSocket?: unknown }).WebSocket;
    delete (globalThis as { WebSocket?: unknown }).WebSocket;

    try {
      expect(() =>
        createBinanceOrderbookSource().watchOrderbook!({ marketName: "BTCUSDT", onOrderbook: () => {} }),
      ).toThrow(/No WebSocket implementation available/);
    } finally {
      if (original !== undefined) (globalThis as { WebSocket?: unknown }).WebSocket = original;
    }
  });
});
