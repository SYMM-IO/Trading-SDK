import { ListingDepositChainId, ListingMarketStatus, type CreatedPool } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { arbitrum, hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const addMarketMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, addMarketMutationOptions };
});

import { useAddMarket } from "./use-add-market";

const POOL: CreatedPool = {
  tokenContractAddress: "0xToken",
  userAddress: "0xUser",
  tokenName: "Symmio",
  tokenTicker: "SYMM",
  tokenDecimal: 18,
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.HYPER_EVM,
  marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
  walletPublicKey: "0xDepositWallet",
  mainPool: null,
};

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0xToken",
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  addMarketMutationOptions.mockReturnValue({ mutationKey: ["addMarket"], mutationFn });
}

describe("useAddMarket", () => {
  afterEach(() => {
    addMarketMutationOptions.mockReset();
  });

  it("forwards the variables, defaults chainId to the connected chain, and returns the pool", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(POOL);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useAddMarket({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARIABLES);
    });

    expect(res).toEqual(POOL);
    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: hyperEvm.id });
  });

  it("forwards an explicit chainId override unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(POOL);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useAddMarket({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...VARIABLES, chainId: arbitrum.id });
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: arbitrum.id });
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("add market failed")));

    const { result } = renderHookWithProviders(() => useAddMarket({ config }));

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
  });
});
