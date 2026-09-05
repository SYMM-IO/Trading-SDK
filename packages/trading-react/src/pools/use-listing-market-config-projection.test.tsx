import { ListingDepositChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getListingMarketDetailQueryOptions = vi.hoisted(() => vi.fn());
const getListingMarketConfigQueryOptions = vi.hoisted(() => vi.fn());
const getUserProfitQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getListingMarketDetailQueryOptions,
    getListingMarketConfigQueryOptions,
    getUserProfitQueryOptions,
  };
});

import { useListingMarketConfigProjection } from "./use-listing-market-config-projection";

const ONE = 10n ** 18n;
const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

/** A pool holding 1000 tokens and no USDC, valued at $1000. */
const DETAIL = {
  buybackRatio: 50,
  maxLeverage: 20,
  totalTokenInPool: 1000n * ONE,
  tvl: 1000n * ONE,
  totalUsdcInPool: 0n,
};

function mockReads({
  detail = DETAIL,
  marketConfig = { userBuybackRatio: null, userMaxLeverage: null },
  userBalanceInTokens = 100n * ONE,
}: {
  detail?: unknown;
  marketConfig?: unknown;
  userBalanceInTokens?: bigint;
} = {}) {
  getListingMarketDetailQueryOptions.mockReturnValue({
    queryKey: ["getListingMarketDetail", {}],
    enabled: true,
    queryFn: vi.fn().mockResolvedValue(detail),
  });
  getListingMarketConfigQueryOptions.mockReturnValue({
    queryKey: ["getListingMarketConfig", {}],
    enabled: true,
    queryFn: vi.fn().mockResolvedValue(marketConfig),
  });
  getUserProfitQueryOptions.mockReturnValue({
    queryKey: ["getUserProfit", {}],
    enabled: true,
    queryFn: vi.fn().mockResolvedValue({ userBalanceInTokens }),
  });
}

const PARAMETERS = {
  accessToken: "tok-abc",
  tokenContractAddress: TOKEN_ADDRESS,
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("useListingMarketConfigProjection", () => {
  afterEach(() => {
    getListingMarketDetailQueryOptions.mockReset();
    getListingMarketConfigQueryOptions.mockReset();
    getUserProfitQueryOptions.mockReset();
  });

  it("weights the entered value by the user's share of the pool", async () => {
    const { config } = createMockSymmioConfig();
    mockReads();

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfigProjection({ ...PARAMETERS, config, buybackRatio: 100 }),
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.share).toBeCloseTo(0.1, 6);
    /** 50 + 0.1 * (100 - 50) */
    expect(result.current.data?.projectedBuybackRatio).toBeCloseTo(55, 6);
  });

  it("shifts from the user's prior opinion once the config read supplies one", async () => {
    const { config } = createMockSymmioConfig();
    mockReads({ marketConfig: { userBuybackRatio: 80, userMaxLeverage: null } });

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfigProjection({ ...PARAMETERS, config, buybackRatio: 100 }),
    );

    /** 50 + 0.1 * (100 - 80) */
    await waitFor(() => expect(result.current.data?.projectedBuybackRatio).toBeCloseTo(52, 6));
  });

  it("still projects when the config read fails, falling back to the pool baseline", async () => {
    const { config } = createMockSymmioConfig();
    mockReads();
    getListingMarketConfigQueryOptions.mockReturnValue({
      queryKey: ["getListingMarketConfig", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("404")),
    });

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfigProjection({ ...PARAMETERS, config, buybackRatio: 100 }),
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.projectedBuybackRatio).toBeCloseTo(55, 6);
    expect(result.current.error).not.toBeNull();
  });

  it("returns no data until the pool detail resolves", () => {
    const { config } = createMockSymmioConfig();
    mockReads();

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfigProjection({ ...PARAMETERS, config, buybackRatio: 100 }),
    );

    expect(result.current.data).toBeUndefined();
  });
});
