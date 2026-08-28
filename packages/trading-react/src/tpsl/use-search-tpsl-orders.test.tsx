import { TpSlSearchOrderType, type SearchTpSlOrdersReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const searchTpSlOrdersQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, searchTpSlOrdersQueryOptions };
});

import { useSearchTpSlOrders } from "./use-search-tpsl-orders";

const PAGE: SearchTpSlOrdersReturnType = { orders: [], count: 0, isComplete: true };

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  searchTpSlOrdersQueryOptions.mockReturnValue({ queryKey: ["searchTpSlOrders", {}], enabled, queryFn });
}

describe("useSearchTpSlOrders", () => {
  afterEach(() => {
    searchTpSlOrdersQueryOptions.mockReset();
  });

  it("reads a pool's book by market and order type, with no account filter", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() =>
      useSearchTpSlOrders({ config, symbolId: 149, conditionalOrderType: TpSlSearchOrderType.SEND_QUOTE }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);

    const [, options] = searchTpSlOrdersQueryOptions.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(options).toMatchObject({
      symbolId: 149,
      conditionalOrderType: TpSlSearchOrderType.SEND_QUOTE,
      chainId: expect.any(Number),
    });
    expect(options.account).toBeUndefined();
  });

  it("takes no parameters at all and falls back to the provider's config — every filter is optional", async () => {
    mockOptions(vi.fn().mockResolvedValue(PAGE), false);

    renderHookWithProviders(() => useSearchTpSlOrders());

    await waitFor(() => expect(searchTpSlOrdersQueryOptions).toHaveBeenCalled());
    const [providerConfig] = searchTpSlOrdersQueryOptions.mock.calls[0] as [unknown];
    expect(providerConfig).toBeDefined();
  });

  it("stays idle when the core options disable the query", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(PAGE);
    mockOptions(queryFn, false);

    const { result } = renderHookWithProviders(() => useSearchTpSlOrders({ config }));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useSearchTpSlOrders({ config, symbolId: 149 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
