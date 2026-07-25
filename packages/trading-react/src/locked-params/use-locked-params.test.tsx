import type { GetLockedParamsReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getLockedParamsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getLockedParamsQueryOptions };
});

import { useLockedParams } from "./use-locked-params";

const RESULT: GetLockedParamsReturnType = {
  cva: "100",
  lf: "5",
  partyAmm: "20",
  partyBmm: "10",
  leverage: "5",
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getLockedParamsQueryOptions.mockReturnValue({
    queryKey: ["getLockedParams", {}],
    enabled: true,
    queryFn,
  });
}

describe("useLockedParams", () => {
  afterEach(() => {
    getLockedParamsQueryOptions.mockReset();
  });

  it("wires the connected chain and market/leverage into the core query options and returns data", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useLockedParams({ symbol: "BTCUSDT", leverage: 5, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getLockedParamsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ symbol: "BTCUSDT", leverage: 5, chainId: expect.any(Number) }),
    );
  });

  it("prefers an explicit chainId over the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useLockedParams({ symbol: "BTCUSDT", leverage: 5, chainId: 42161, config }));

    await waitFor(() => expect(getLockedParamsQueryOptions).toHaveBeenCalled());
    expect(getLockedParamsQueryOptions).toHaveBeenCalledWith(config, expect.objectContaining({ chainId: 42161 }));
  });

  it("forwards consumer-supplied query overrides into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() =>
      useLockedParams({ symbol: "BTCUSDT", leverage: 5, config, query: { staleTime: 5_000 } }),
    );

    await waitFor(() => expect(getLockedParamsQueryOptions).toHaveBeenCalled());
    expect(getLockedParamsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ staleTime: 5_000 }) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useLockedParams({ symbol: "BTCUSDT", leverage: 5, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("solver down");
  });
});
