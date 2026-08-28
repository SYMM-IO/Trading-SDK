import type { GetTradeVolumeReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getTradeVolumeQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getTradeVolumeQueryOptions };
});

import { useTradeVolume } from "./use-trade-volume";

const RESULT: GetTradeVolumeReturnType = [
  { timestamp: "2026-07-09T00:00:00Z", volume: "448.699250908231105583" },
  { timestamp: "2026-07-10T00:00:00Z", volume: "98000" },
];

function mockOptions(queryFn: () => Promise<unknown>) {
  getTradeVolumeQueryOptions.mockReturnValue({
    queryKey: ["getTradeVolume", {}],
    enabled: true,
    queryFn,
  });
}

describe("useTradeVolume", () => {
  afterEach(() => {
    getTradeVolumeQueryOptions.mockReset();
  });

  it("wires the connected chain and symbol id into the core query options and returns data", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useTradeVolume({ symbolId: 1, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getTradeVolumeQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ symbolId: 1, chainId: expect.any(Number) }),
    );
  });

  it("prefers an explicit chainId over the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useTradeVolume({ symbolId: 1, chainId: 42161, config }));

    await waitFor(() => expect(getTradeVolumeQueryOptions).toHaveBeenCalled());
    expect(getTradeVolumeQueryOptions).toHaveBeenCalledWith(config, expect.objectContaining({ chainId: 42161 }));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useTradeVolume({ symbolId: 1, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("solver down");
  });
});
