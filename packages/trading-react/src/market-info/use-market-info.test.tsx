import type { GetMarketInfoReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getMarketInfoQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getMarketInfoQueryOptions };
});

import { useMarketInfo } from "./use-market-info";

const RESULT: GetMarketInfoReturnType = {
  markets: [{ symbol: "BTCUSDT", tradingVolume: 12345.6, lifetimeValue: 98765.4 }],
  totalValue24h: 12345.6,
  totalLifetimeValue: 98765.4,
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getMarketInfoQueryOptions.mockReturnValue({
    queryKey: ["getMarketInfo", {}],
    enabled: true,
    queryFn,
  });
}

describe("useMarketInfo", () => {
  afterEach(() => {
    getMarketInfoQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns data without default polling", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useMarketInfo({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getMarketInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
    const [, forwardedOptions] = getMarketInfoQueryOptions.mock.lastCall ?? [];
    expect(forwardedOptions?.query).toBeUndefined();
  });

  it("forwards a consumer-supplied query.refetchInterval to opt into polling", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useMarketInfo({ config, query: { refetchInterval: 5_000 } }));

    await waitFor(() => expect(getMarketInfoQueryOptions).toHaveBeenCalled());
    expect(getMarketInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: 5_000 }) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useMarketInfo({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
