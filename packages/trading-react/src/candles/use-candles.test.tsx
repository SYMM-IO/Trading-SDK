import type { CandleSource } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useCandles } from "./use-candles";

const CANDLES = [{ time: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }];

function createStubSource(
  id = "stub",
  getCandles = vi.fn<CandleSource["getCandles"]>(async () => ({ candles: CANDLES, noMoreData: false })),
) {
  const source: CandleSource = {
    id,
    priceBasis: "reference-exchange",
    supportedResolutions: ["1m"],
    maxCandlesPerRequest: 1000,
    getSymbol: vi.fn(async () => undefined),
    getCandles,
    watchCandles: vi.fn(() => () => {}),
  };
  return { source, getCandles };
}

const RANGE = { marketName: "BTCUSDT", resolution: "1m", from: 1_700_000_000_000, to: 1_700_003_600_000 } as const;

describe("useCandles", () => {
  it("fetches bars from the source", async () => {
    const { source, getCandles } = createStubSource();

    const { result } = renderHookWithProviders(() => useCandles({ source, ...RANGE }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.candles).toEqual(CANDLES);
    expect(result.current.data?.noMoreData).toBe(false);
    expect(getCandles).toHaveBeenCalledWith(expect.objectContaining({ marketName: "BTCUSDT", resolution: "1m" }));
  });

  it("does not fetch while disabled", () => {
    const { source, getCandles } = createStubSource();

    renderHookWithProviders(() => useCandles({ source, ...RANGE, query: { enabled: false } }));

    expect(getCandles).not.toHaveBeenCalled();
  });

  it("normalizes a source failure to a SymmioRequestError", async () => {
    const { source } = createStubSource(
      "stub",
      vi.fn<CandleSource["getCandles"]>(async () => {
        throw new Error("venue down");
      }),
    );

    const { result } = renderHookWithProviders(() => useCandles({ source, ...RANGE, query: { retry: false } }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("venue down");
  });

  it("keys the cache by source id, so two venues never share bars", async () => {
    const binance = createStubSource("binance:usd-m-futures");
    const other = createStubSource(
      "other-venue",
      vi.fn<CandleSource["getCandles"]>(async () => ({ candles: [], noMoreData: true })),
    );

    const { result, rerender } = renderHookWithProviders(
      ({ source }: { source: CandleSource }) => useCandles({ source, ...RANGE }),
      { initialProps: { source: binance.source } },
    );

    await waitFor(() => expect(result.current.data?.candles).toEqual(CANDLES));

    rerender({ source: other.source });
    await waitFor(() => expect(result.current.data?.candles).toEqual([]));

    expect(other.getCandles).toHaveBeenCalledTimes(1);
  });

  it("passes the bar limit through to the source", async () => {
    const { source, getCandles } = createStubSource();

    const { result } = renderHookWithProviders(() => useCandles({ source, ...RANGE, limit: 250 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCandles.mock.calls[0]?.[0].limit).toBe(250);
  });
});
