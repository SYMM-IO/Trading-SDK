import type { GetOpenInterestBySymbolIdReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getOpenInterestBySymbolIdQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getOpenInterestBySymbolIdQueryOptions };
});

import { DEFAULT_NOTIONAL_CAP_POLLING_MS } from "./use-notional-cap-by-symbol-id";
import { useOpenInterestBySymbolId } from "./use-open-interest-by-symbol-id";

const RESULT: GetOpenInterestBySymbolIdReturnType = {
  symbolId: 132,
  symbol: "BTCUSDT",
  openInterest: 250_000,
  totalCap: 1_000_000,
  error: null,
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getOpenInterestBySymbolIdQueryOptions.mockReturnValue({
    queryKey: ["getOpenInterestBySymbolId", {}],
    enabled: true,
    queryFn,
  });
}

describe("useOpenInterestBySymbolId", () => {
  afterEach(() => {
    getOpenInterestBySymbolIdQueryOptions.mockReset();
  });

  it("wires the connected chain and symbol id into the core query options and returns data", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useOpenInterestBySymbolId({ symbolId: 132, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ symbolId: 132, chainId: expect.any(Number) }),
    );
  });

  it("polls at DEFAULT_NOTIONAL_CAP_POLLING_MS by default", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useOpenInterestBySymbolId({ symbolId: 132, config }));

    await waitFor(() => expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalled());
    expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        query: expect.objectContaining({ refetchInterval: DEFAULT_NOTIONAL_CAP_POLLING_MS }),
      }),
    );
  });

  it("maps a custom pollingInterval onto query.refetchInterval", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useOpenInterestBySymbolId({ symbolId: 132, pollingInterval: 3_000, config }));

    await waitFor(() => expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalled());
    expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: 3_000 }) }),
    );
  });

  it("disables polling when pollingInterval is false", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useOpenInterestBySymbolId({ symbolId: 132, pollingInterval: false, config }));

    await waitFor(() => expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalled());
    expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: false }) }),
    );
  });

  it("lets a consumer query.refetchInterval override the pollingInterval default", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() =>
      useOpenInterestBySymbolId({ symbolId: 132, config, query: { refetchInterval: 9_000 } }),
    );

    await waitFor(() => expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalled());
    expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ refetchInterval: 9_000 }) }),
    );
  });

  it("prefers an explicit chainId over the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useOpenInterestBySymbolId({ symbolId: 132, chainId: 42161, config }));

    await waitFor(() => expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalled());
    expect(getOpenInterestBySymbolIdQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 42161 }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useOpenInterestBySymbolId({ symbolId: 132, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("solver down");
  });
});
