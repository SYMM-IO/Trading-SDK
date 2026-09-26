import { PositionType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const estimate = vi.hoisted(() => vi.fn().mockResolvedValue({ estimatedPrice: "100" }));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getEstimatedPriceQueryOptions: (...args: Parameters<typeof actual.getEstimatedPriceQueryOptions>) => ({
      ...actual.getEstimatedPriceQueryOptions(...args),
      queryFn: () => estimate(args[1]),
    }),
  };
});

import { useEstimatedPrice } from "./use-estimated-price";

describe("useEstimatedPrice readiness", () => {
  it("reports pending debounce even while the previous estimate is cached", async () => {
    const { config } = createMockSymmioConfig();
    const { result, rerender } = renderHookWithProviders(
      ({ quantity, price }) =>
        useEstimatedPrice({
          config,
          symbolId: 1,
          quantity,
          price,
          positionType: PositionType.LONG,
          entry: "open",
          debounceMs: 20,
        }),
      { initialProps: { quantity: "1", price: "100" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isDebouncing).toBe(false);
    rerender({ quantity: "2", price: "101" });
    expect(result.current.isDebouncing).toBe(true);
    expect(result.current.data).toEqual({ estimatedPrice: "100" });
    await waitFor(() => expect(result.current.isDebouncing).toBe(false));
    await waitFor(() =>
      expect(estimate).toHaveBeenLastCalledWith(expect.objectContaining({ quantity: "2", price: "101" })),
    );
  });
});
