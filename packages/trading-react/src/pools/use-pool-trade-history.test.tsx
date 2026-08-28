import { QuoteCloseType, type GetPoolTradeHistoryReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getPoolTradeHistoryQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getPoolTradeHistoryQueryOptions };
});

import { usePoolTradeHistory } from "./use-pool-trade-history";

const RESULT = { rows: [] } as unknown as GetPoolTradeHistoryReturnType;

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  getPoolTradeHistoryQueryOptions.mockReturnValue({ queryKey: ["getPoolTradeHistory", {}], enabled, queryFn });
}

describe("usePoolTradeHistory", () => {
  afterEach(() => {
    getPoolTradeHistoryQueryOptions.mockReset();
  });

  it("forwards the market, close-type filter and paging into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      usePoolTradeHistory({ config, symbolId: 149, closeType: QuoteCloseType.Liquidated, first: 25, skip: 50 }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getPoolTradeHistoryQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        symbolId: 149,
        closeType: QuoteCloseType.Liquidated,
        first: 25,
        skip: 50,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle while the pool has no solver market", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(RESULT);
    mockOptions(queryFn, false);

    const { result } = renderHookWithProviders(() => usePoolTradeHistory({ config, symbolId: undefined }));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => usePoolTradeHistory({ config, symbolId: 149 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
