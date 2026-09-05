import { POOL_OPEN_QUOTE_STATUSES, SymmioSupportedChainId, type GetPoolQuotesReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getPoolQuotesQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getPoolQuotesQueryOptions };
});

import { usePoolQuotes } from "./use-pool-quotes";

const RESULT: GetPoolQuotesReturnType = {
  quotes: [
    {
      id: "8232-source",
      quoteId: 8232n,
      quoteStatus: 4,
      positionType: 0,
      orderTypeOpen: 1,
      symbol: "SYMM",
      symbolId: 149,
      partyA: "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a",
      partyB: null,
      quantity: 1000000000000000000n,
      closedAmount: 0n,
      quantityToClose: 0n,
      openedPrice: 1n,
      requestedOpenPrice: 1n,
      averageClosedPrice: 0n,
      closePrice: 0n,
      initialOpenedPrice: 1n,
      liquidateAmount: null,
      liquidatePrice: null,
      timestamp: 1782000000,
      blockNumber: 1n,
    },
  ],
};

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  getPoolQuotesQueryOptions.mockReturnValue({ queryKey: ["getPoolQuotes", {}], enabled, queryFn });
}

describe("usePoolQuotes", () => {
  afterEach(() => {
    getPoolQuotesQueryOptions.mockReset();
  });

  it("forwards the market and status filter into the core query options and returns the book", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      usePoolQuotes({ config, symbolId: 149, quoteStatuses: POOL_OPEN_QUOTE_STATUSES }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getPoolQuotesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        symbolId: 149,
        quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
        chainId: expect.any(Number),
      }),
    );
  });

  it("defaults the chain to the provider's rather than leaving it unset", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => usePoolQuotes({ config, symbolId: 149 }));

    await waitFor(() => expect(getPoolQuotesQueryOptions).toHaveBeenCalled());
    const [, options] = getPoolQuotesQueryOptions.mock.calls[0] as [unknown, { chainId?: number }];
    expect(options.chainId).toEqual(expect.any(Number));
  });

  it("keeps an explicit chainId instead of overriding it with the provider's", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => usePoolQuotes({ config, symbolId: 149, chainId: SymmioSupportedChainId.BASE }));

    await waitFor(() => expect(getPoolQuotesQueryOptions).toHaveBeenCalled());
    expect(getPoolQuotesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: SymmioSupportedChainId.BASE }),
    );
  });

  it("stays idle while the pool has no solver market", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(RESULT);
    mockOptions(queryFn, false);

    const { result } = renderHookWithProviders(() => usePoolQuotes({ config, symbolId: null }));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => usePoolQuotes({ config, symbolId: 149 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
