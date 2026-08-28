import type { GetInventoryTvlHistoryReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getInventoryTvlHistoryQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getInventoryTvlHistoryQueryOptions };
});

import { useInventoryTvlHistory } from "./use-inventory-tvl-history";

const HISTORY: GetInventoryTvlHistoryReturnType = [
  { timestamp: 1_752_364_800, tvl: 177780000000000000000n },
  { timestamp: 1_752_451_200, tvl: 180000000000000000000n },
];

const SYMBOL_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

function mockOptions(queryFn: () => Promise<unknown>) {
  getInventoryTvlHistoryQueryOptions.mockReturnValue({
    queryKey: ["getInventoryTvlHistory", {}],
    enabled: true,
    queryFn,
  });
}

describe("useInventoryTvlHistory", () => {
  afterEach(() => {
    getInventoryTvlHistoryQueryOptions.mockReset();
  });

  it("forwards the symbol address and connected chain into the core query options and returns the series", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(HISTORY));

    const { result } = renderHookWithProviders(() => useInventoryTvlHistory({ config, symbolAddress: SYMBOL_ADDRESS }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(HISTORY);
    expect(getInventoryTvlHistoryQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ symbolAddress: SYMBOL_ADDRESS, chainId: expect.any(Number) }),
    );
  });

  it("stays idle before a pool is picked", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(HISTORY);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() => useInventoryTvlHistory({ config, symbolAddress: "" }));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useInventoryTvlHistory({ config, symbolAddress: SYMBOL_ADDRESS }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
