import { ListingDepositChainId, ListingMarketStatus, type GetUserListingMarketsReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getUserListingMarketsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getUserListingMarketsQueryOptions };
});

import { useUserListingMarkets } from "./use-user-listing-markets";

const PAGE: GetUserListingMarketsReturnType = {
  total: 3,
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
      userDeposit: 5000000000000000000n,
      userSharePercentage: 12.5,
      userRevenue: 250000000000000000n,
    },
  ],
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getUserListingMarketsQueryOptions.mockReturnValue({
    queryKey: ["getUserListingMarkets", {}],
    enabled: true,
    queryFn,
  });
}

describe("useUserListingMarkets", () => {
  afterEach(() => {
    getUserListingMarketsQueryOptions.mockReset();
  });

  it("forwards the access token and connected chain into the core query options and returns the page", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() => useUserListingMarkets({ config, accessToken: "tok-abc" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);
    expect(getUserListingMarketsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accessToken: "tok-abc", chainId: expect.any(Number) }),
    );
  });

  it("stays idle when the access token is empty", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(PAGE);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() => useUserListingMarkets({ config, accessToken: "" }));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isPending).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useUserListingMarkets({ config, accessToken: "tok-abc" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
