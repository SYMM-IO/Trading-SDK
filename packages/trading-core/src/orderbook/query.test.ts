import { describe, expect, it, vi } from "vitest";
import { getOrderbookQueryKey, getOrderbookQueryOptions } from "./query";
import type { Orderbook, OrderbookSource } from "./types";

const BOOK: Orderbook = {
  marketName: "BTCUSDT",
  bids: [{ price: 99, size: 1 }],
  asks: [{ price: 101, size: 1 }],
  lastUpdateId: 1,
  timestamp: 0,
};

function stubSource(id = "binance:usd-m-futures"): OrderbookSource {
  return {
    id,
    priceBasis: "reference-exchange",
    supportedLimits: [5, 20, 1000],
    defaultLimit: 1000,
    getSymbol: vi.fn(async () => undefined),
    getOrderbook: vi.fn(async () => BOOK),
  };
}

describe("getOrderbookQueryKey", () => {
  it("namespaces the key and carries the identifying parameters", () => {
    expect(getOrderbookQueryKey({ sourceId: "binance:spot", marketName: "BTCUSDT", limit: 20 })).toEqual([
      "getOrderbook",
      { sourceId: "binance:spot", marketName: "BTCUSDT", limit: 20 },
    ]);
  });

  it("separates two sources, so switching venues never reads the other's book", () => {
    const futures = getOrderbookQueryKey({ sourceId: "binance:usd-m-futures", marketName: "BTCUSDT" });
    const spot = getOrderbookQueryKey({ sourceId: "binance:spot", marketName: "BTCUSDT" });

    expect(futures).not.toEqual(spot);
  });

  it("separates two markets", () => {
    expect(getOrderbookQueryKey({ sourceId: "s", marketName: "BTCUSDT" })).not.toEqual(
      getOrderbookQueryKey({ sourceId: "s", marketName: "ETHUSDT" }),
    );
  });

  it("drops an absent limit rather than keying on `undefined`", () => {
    const [, params] = getOrderbookQueryKey({ sourceId: "s", marketName: "BTCUSDT", limit: undefined });

    expect(params).not.toHaveProperty("limit");
  });

  it("separates two depths, since a deeper book is a different result", () => {
    expect(getOrderbookQueryKey({ sourceId: "s", marketName: "B", limit: 20 })).not.toEqual(
      getOrderbookQueryKey({ sourceId: "s", marketName: "B", limit: 1000 }),
    );
  });
});

describe("getOrderbookQueryOptions", () => {
  it("builds the key from the source and the requested book", () => {
    const options = getOrderbookQueryOptions(stubSource(), { marketName: "BTCUSDT", limit: 20 });

    expect(options.queryKey).toEqual([
      "getOrderbook",
      { sourceId: "binance:usd-m-futures", marketName: "BTCUSDT", limit: 20 },
    ]);
  });

  it("delegates fetching to the source", async () => {
    const source = stubSource();
    const options = getOrderbookQueryOptions(source, { marketName: "BTCUSDT", limit: 20 });

    await expect(options.queryFn()).resolves.toEqual(BOOK);
    expect(source.getOrderbook).toHaveBeenCalledWith({ marketName: "BTCUSDT", limit: 20 });
  });

  it("leaves the depth to the source when the caller does not pick one", async () => {
    const source = stubSource();
    await getOrderbookQueryOptions(source, { marketName: "BTCUSDT" }).queryFn();

    expect(source.getOrderbook).toHaveBeenCalledWith({ marketName: "BTCUSDT", limit: undefined });
  });

  it("is enabled by default", () => {
    expect(getOrderbookQueryOptions(stubSource(), { marketName: "BTCUSDT" }).enabled).toBe(true);
  });

  it("honours an explicit disable", () => {
    const options = getOrderbookQueryOptions(stubSource(), {
      marketName: "BTCUSDT",
      query: { enabled: false },
    });

    expect(options.enabled).toBe(false);
  });

  it("spreads the caller's other TanStack overrides through", () => {
    const options = getOrderbookQueryOptions(stubSource(), {
      marketName: "BTCUSDT",
      query: { staleTime: 5_000, retry: 2 },
    });

    expect(options.staleTime).toBe(5_000);
    expect(options.retry).toBe(2);
  });

  it("does not let a caller override the key or the fetcher", () => {
    const options = getOrderbookQueryOptions(stubSource(), {
      marketName: "BTCUSDT",
      query: { staleTime: 1 },
    });

    expect(options.queryKey[0]).toBe("getOrderbook");
    expect(typeof options.queryFn).toBe("function");
  });
});
