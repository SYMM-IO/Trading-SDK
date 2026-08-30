import { ListingDepositChainId, type GetListingMarketConfigReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getListingMarketConfigQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getListingMarketConfigQueryOptions };
});

import { useListingMarketConfig } from "./use-listing-market-config";

const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

const MARKET_CONFIG: GetListingMarketConfigReturnType = {
  tokenContractAddress: TOKEN_ADDRESS,
  depositChain: ListingDepositChainId.HYPER_EVM,
  userMaxLeverage: 10,
  userBuybackRatio: 75,
  maxLeverage: 20,
  buybackRatio: 50,
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getListingMarketConfigQueryOptions.mockReturnValue({
    queryKey: ["getListingMarketConfig", {}],
    enabled: true,
    queryFn,
  });
}

describe("useListingMarketConfig", () => {
  afterEach(() => {
    getListingMarketConfigQueryOptions.mockReset();
  });

  it("forwards the token, market and connected chain into the core query options and returns the config", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(MARKET_CONFIG));

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfig({
        config,
        accessToken: "tok-abc",
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MARKET_CONFIG);
    expect(getListingMarketConfigQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        accessToken: "tok-abc",
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle when the access token is empty", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(MARKET_CONFIG);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfig({
        config,
        accessToken: "",
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isPending).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("stays idle when the token contract address is empty", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(MARKET_CONFIG);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfig({
        config,
        accessToken: "tok-abc",
        tokenContractAddress: "",
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isPending).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() =>
      useListingMarketConfig({
        config,
        accessToken: "tok-abc",
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
