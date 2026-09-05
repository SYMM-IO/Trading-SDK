import type { GetNotionalCapAllReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getNotionalCapAllQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getNotionalCapAllQueryOptions };
});

import { useNotionalCapAll } from "./use-notional-cap-all";
import { DEFAULT_NOTIONAL_CAP_POLLING_MS } from "./use-notional-cap-by-symbol-id";

const RESULT: GetNotionalCapAllReturnType = {
  count: 1,
  totalOpenInterest: 250_000,
  totalUsed: 250_000,
  symbols: [
    {
      kind: "enigma",
      symbolId: 132,
      symbol: "BTCUSDT",
      totalCap: 1_000_000,
      used: 250_000,
      availableToLong: 400_000,
      availableToShort: 350_000,
      openInterest: 250_000,
      price: 65_000,
      tokenBalance: 12,
      usdcBalance: 500_000,
      error: null,
    },
  ],
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getNotionalCapAllQueryOptions.mockReturnValue({
    queryKey: ["getNotionalCapAll", {}],
    enabled: true,
    queryFn,
  });
}

describe("useNotionalCapAll", () => {
  afterEach(() => {
    getNotionalCapAllQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns the aggregate rows", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useNotionalCapAll({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getNotionalCapAllQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });

  it("polls at DEFAULT_NOTIONAL_CAP_POLLING_MS by default", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useNotionalCapAll({ config }));

    await waitFor(() => expect(getNotionalCapAllQueryOptions).toHaveBeenCalled());
    expect(getNotionalCapAllQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        query: expect.objectContaining({ refetchInterval: DEFAULT_NOTIONAL_CAP_POLLING_MS }),
      }),
    );
  });

  it("maps a custom pollingInterval onto query.refetchInterval", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useNotionalCapAll({ pollingInterval: 3_000, config }));

    await waitFor(() => expect(getNotionalCapAllQueryOptions).toHaveBeenCalled());
    expect(getNotionalCapAllQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: 3_000 }) }),
    );
  });

  it("disables polling when pollingInterval is false", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useNotionalCapAll({ pollingInterval: false, config }));

    await waitFor(() => expect(getNotionalCapAllQueryOptions).toHaveBeenCalled());
    expect(getNotionalCapAllQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: false }) }),
    );
  });

  it("lets a consumer query.refetchInterval override the pollingInterval default", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useNotionalCapAll({ config, query: { refetchInterval: 9_000 } }));

    await waitFor(() => expect(getNotionalCapAllQueryOptions).toHaveBeenCalled());
    expect(getNotionalCapAllQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: 9_000 }) }),
    );
  });

  it("prefers an explicit chainId over the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useNotionalCapAll({ chainId: 42161, config }));

    await waitFor(() => expect(getNotionalCapAllQueryOptions).toHaveBeenCalled());
    expect(getNotionalCapAllQueryOptions).toHaveBeenCalledWith(config, expect.objectContaining({ chainId: 42161 }));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useNotionalCapAll({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("solver down");
  });
});
