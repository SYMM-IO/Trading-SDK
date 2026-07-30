import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSolverPriceRangeQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSolverPriceRangeQueryOptions };
});

import { useSolverPriceRange } from "./use-solver-price-range";

const RESULT = { min_price: "1", max_price: "2" };

function mockOptions(queryFn: () => Promise<unknown>) {
  getSolverPriceRangeQueryOptions.mockReturnValue({
    queryKey: ["getSolverPriceRange", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSolverPriceRange", () => {
  afterEach(() => {
    getSolverPriceRangeQueryOptions.mockReset();
  });

  it("wires chainId, solverId, and symbol into the core query options and returns the range", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      useSolverPriceRange({ config, chainId: 8453, solverId: "rasa", symbol: "BTCUSDT" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getSolverPriceRangeQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 8453, solverId: "rasa", symbol: "BTCUSDT" }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSolverPriceRange({ config, symbol: "BTCUSDT" }));

    await waitFor(() => expect(getSolverPriceRangeQueryOptions).toHaveBeenCalled());
    expect(getSolverPriceRangeQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number), symbol: "BTCUSDT" }),
    );
  });
});
