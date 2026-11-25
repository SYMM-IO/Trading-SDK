import {
  ListingDepositChainId,
  ListingMarketStatus,
  SymmioSupportedChainId,
  type CreatedPool,
} from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { arbitrum } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, createTestQueryClient, renderHookWithProviders } from "../test/test-utils";

const listMarketMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, listMarketMutationOptions };
});

import { useListMarket } from "./use-list-market";

const POOL: CreatedPool = {
  tokenContractAddress: "0xToken",
  userAddress: "0xUser",
  tokenName: "Symmio",
  tokenTicker: "SYMM",
  tokenDecimal: 18,
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.BASE,
  marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
  walletPublicKey: "0xDepositWallet",
  mainPool: null,
};

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0xToken",
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.BASE,
} as const;

const INVALIDATED_KEYS = [
  ["getListingMarkets"],
  ["getUserListingMarkets"],
  ["getListingMarketDetail"],
  ["getListingStatus"],
  ["getWeeklyListingLimit"],
];

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  listMarketMutationOptions.mockReturnValue({ mutationKey: ["listMarket"], mutationFn });
}

describe("useListMarket", () => {
  afterEach(() => {
    listMarketMutationOptions.mockReset();
  });

  it("forwards every variable, defaults chainId to the connected chain, and returns the pool", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(POOL);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useListMarket({ config }));

    const variables = {
      ...VARIABLES,
      isTax: true,
      userWhitelistTax: false,
      additionalChains: [56],
      poolAddress: "0xPool",
      cexList: ["Binance"],
    };
    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(variables);
    });

    expect(res).toEqual(POOL);
    expect(mutationFn).toHaveBeenCalledWith({ ...variables, chainId: arbitrum.id });
  });

  it("forwards an explicit chainId override unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(POOL);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useListMarket({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...VARIABLES, chainId: SymmioSupportedChainId.BASE });
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: SymmioSupportedChainId.BASE });
  });

  it("invalidates the catalog, Your Pools, market detail, listing status and weekly limit on success", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockResolvedValue(POOL));
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useListMarket({ config }), { queryClient });

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(INVALIDATED_KEYS);
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError and invalidates nothing", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("list market failed")));
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useListMarket({ config }), { queryClient });

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARIABLES);
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
    expect(invalidate).not.toHaveBeenCalled();
  });
});
