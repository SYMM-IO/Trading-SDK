import type { GetFundingInfoReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getFundingInfoQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getFundingInfoQueryOptions };
});

import { useFundingInfo } from "./use-funding-info";

const RESULT: GetFundingInfoReturnType = [
  {
    symbol: "BTCUSDT",
    nextFundingRateLong: 0.0001,
    nextFundingRateShort: -0.0001,
    nextFundingTime: 1783209600000,
    epochDurationSeconds: 43200,
  },
];

function mockOptions(queryFn: () => Promise<unknown>) {
  getFundingInfoQueryOptions.mockReturnValue({
    queryKey: ["getFundingInfo", {}],
    enabled: true,
    queryFn,
  });
}

describe("useFundingInfo", () => {
  afterEach(() => {
    getFundingInfoQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns data without default polling", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useFundingInfo({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getFundingInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
    const [, forwardedOptions] = getFundingInfoQueryOptions.mock.lastCall ?? [];
    expect(forwardedOptions?.query).toBeUndefined();
  });

  it("forwards a consumer-supplied query.refetchInterval to opt into polling", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useFundingInfo({ config, query: { refetchInterval: 5_000 } }));

    await waitFor(() => expect(getFundingInfoQueryOptions).toHaveBeenCalled());
    expect(getFundingInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: 5_000 }) }),
    );
  });

  it("forwards the symbols filter into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useFundingInfo({ config, symbols: ["BTCUSDT", "ETHUSDT"] }));

    await waitFor(() => expect(getFundingInfoQueryOptions).toHaveBeenCalled());
    expect(getFundingInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ symbols: ["BTCUSDT", "ETHUSDT"] }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useFundingInfo({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
