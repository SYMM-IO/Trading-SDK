import { ListingDepositChainId, ListingMarketStatus, type GetListingMarketsReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getListingMarketsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getListingMarketsQueryOptions };
});

import { useListingMarkets } from "./use-listing-markets";

const PAGE: GetListingMarketsReturnType = {
  total: 271,
  limit: 20,
  offset: 0,
  items: [
    {
      contractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
      chainId: ListingDepositChainId.BASE,
      symbolId: 1,
      tokenTicker: "SYMM",
      tokenName: "Symmio",
      maxLeverage: 18,
      marketCap: 8262743000000000000000000n,
      vol24h: 36916359374753173167n,
      tvl: 71036417337070986131n,
      liquidity: 208438031756981981831n,
      openInterest: 52811628682812151810n,
      reward24h: 0n,
      apr: 0n,
      aprByWindow: { h1: 0n, h6: 0n, h24: 0n, d30: 0n },
      tvlDrivenApy: { h1: 0n, h6: 0n, h24: 0n, d30: null, lifetime: 0n },
      priceDrivenApy: { h1: 0n, h6: 0n, h24: 0n, d30: null, lifetime: 0n },
      listingTime: 1772715579,
      marketStatus: ListingMarketStatus.LISTED,
    },
  ],
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getListingMarketsQueryOptions.mockReturnValue({
    queryKey: ["getListingMarkets", {}],
    enabled: true,
    queryFn,
  });
}

describe("useListingMarkets", () => {
  afterEach(() => {
    getListingMarketsQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns the page", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() => useListingMarkets({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);
    expect(getListingMarketsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });

  it("takes no required parameters", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() => useListingMarkets({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, forwardedOptions] = getListingMarketsQueryOptions.mock.lastCall ?? [];
    expect(forwardedOptions?.query).toBeUndefined();
  });

  it("forwards search, filter, sort, and pagination inputs to core", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    renderHookWithProviders(() =>
      useListingMarkets({
        config,
        search: "pepe",
        chainIds: [ListingDepositChainId.SOLANA],
        marketStatus: ListingMarketStatus.LISTED,
        sortBy: "tvl",
        orderBy: "desc",
        limit: 25,
        offset: 50,
        filters: { tvl: { min: 1n } },
      }),
    );

    await waitFor(() => expect(getListingMarketsQueryOptions).toHaveBeenCalled());
    expect(getListingMarketsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        search: "pepe",
        chainIds: [ListingDepositChainId.SOLANA],
        marketStatus: ListingMarketStatus.LISTED,
        sortBy: "tvl",
        orderBy: "desc",
        limit: 25,
        offset: 50,
        filters: { tvl: { min: 1n } },
      }),
    );
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useListingMarkets({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
