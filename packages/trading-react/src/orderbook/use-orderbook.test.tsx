import { SymmError, type Orderbook, type OrderbookSource } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useBinanceOrderbookSource } from "./use-binance-orderbook-source";
import { useOrderbook } from "./use-orderbook";

const BOOK: Orderbook = {
  marketName: "BTCUSDT",
  bids: [{ price: 99, size: 1 }],
  asks: [{ price: 101, size: 1 }],
  lastUpdateId: 42,
  timestamp: 0,
};

function stubSource(id: string, getOrderbook = vi.fn(async () => BOOK)): OrderbookSource {
  return {
    id,
    priceBasis: "reference-exchange",
    supportedLimits: [20, 1000],
    defaultLimit: 1000,
    getSymbol: vi.fn(async () => undefined),
    getOrderbook,
  };
}

describe("useOrderbook", () => {
  it("resolves a snapshot", async () => {
    const source = stubSource("stub");

    const { result } = renderHookWithProviders(() => useOrderbook({ source, marketName: "BTCUSDT", limit: 20 }));

    await waitFor(() => expect(result.current.data?.lastUpdateId).toBe(42));
    expect(source.getOrderbook).toHaveBeenCalledWith({ marketName: "BTCUSDT", limit: 20 });
  });

  it("keeps two sources in separate cache entries", async () => {
    const futures = stubSource(
      "binance:usd-m-futures",
      vi.fn(async () => BOOK),
    );
    const spot = stubSource(
      "binance:spot",
      vi.fn(async () => ({ ...BOOK, lastUpdateId: 7 })),
    );

    const { result } = renderHookWithProviders(() => ({
      a: useOrderbook({ source: futures, marketName: "BTCUSDT" }),
      b: useOrderbook({ source: spot, marketName: "BTCUSDT" }),
    }));

    await waitFor(() => expect(result.current.a.data?.lastUpdateId).toBe(42));
    await waitFor(() => expect(result.current.b.data?.lastUpdateId).toBe(7));
    expect(futures.getOrderbook).toHaveBeenCalledTimes(1);
    expect(spot.getOrderbook).toHaveBeenCalledTimes(1);
  });

  it("does not fetch while disabled", async () => {
    const source = stubSource("stub");

    const { result } = renderHookWithProviders(() =>
      useOrderbook({ source, marketName: "BTCUSDT", query: { enabled: false } }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(source.getOrderbook).not.toHaveBeenCalled();
  });

  it("normalizes an SDK error into a request error, preserving its code", async () => {
    const source = stubSource(
      "stub",
      vi.fn(async () => {
        throw new SymmError("validation", "UNSUPPORTED_DEPTH_LIMIT", "bad limit");
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useOrderbook({ source, marketName: "BTCUSDT", query: { retry: false } }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    /** Every `SymmError` normalizes to the `sdk` kind; the `code` is what identifies it. */
    expect(result.current.error?.kind).toBe("sdk");
    expect(result.current.error?.code).toBe("UNSUPPORTED_DEPTH_LIMIT");
    expect(result.current.error?.message).toContain("bad limit");
  });
});

describe("useBinanceOrderbookSource", () => {
  it("keeps one source across renders, so a live subscription is not re-dialled", () => {
    const { result, rerender } = renderHookWithProviders(() => useBinanceOrderbookSource());
    const first = result.current;

    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  it("describes itself by market", () => {
    const { result } = renderHookWithProviders(() => useBinanceOrderbookSource());

    expect(result.current.id).toBe("binance:usd-m-futures");
    expect(result.current.priceBasis).toBe("reference-exchange");
    expect(result.current.defaultLimit).toBe(1000);
  });

  it("rebuilds when an option changes", () => {
    /** Annotated so the prop keeps its union type rather than narrowing to the initial literal. */
    const initialProps: { market: "usd-m-futures" | "spot" } = { market: "usd-m-futures" };

    const { result, rerender } = renderHookWithProviders(
      ({ market }: { market: "usd-m-futures" | "spot" }) => useBinanceOrderbookSource({ market }),
      { initialProps },
    );
    const first = result.current;

    rerender({ market: "spot" });

    expect(result.current).not.toBe(first);
    expect(result.current.id).toBe("binance:spot");
  });

  it("rebuilds when the endpoint is overridden", () => {
    const { result, rerender } = renderHookWithProviders(
      ({ restUrl }: { restUrl?: string }) => useBinanceOrderbookSource({ restUrl }),
      { initialProps: {} as { restUrl?: string } },
    );
    const first = result.current;

    rerender({ restUrl: "https://proxy.example" });

    expect(result.current).not.toBe(first);
  });
});
