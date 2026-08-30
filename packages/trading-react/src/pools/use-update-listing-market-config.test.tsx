import { ListingDepositChainId } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { base, hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const updateListingMarketConfigMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, updateListingMarketConfigMutationOptions };
});

import { useUpdateListingMarketConfig } from "./use-update-listing-market-config";

const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

const UPDATED = {
  tokenContractAddress: TOKEN_ADDRESS,
  depositChain: ListingDepositChainId.HYPER_EVM,
  userMaxLeverage: 20,
  userBuybackRatio: 50,
  maxLeverage: 18,
  buybackRatio: 52,
};

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: TOKEN_ADDRESS,
  depositChain: ListingDepositChainId.HYPER_EVM,
  maxLeverage: 20,
  buybackRatio: 50,
} as const;

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  updateListingMarketConfigMutationOptions.mockReturnValue({
    mutationKey: ["updateListingMarketConfig"],
    mutationFn,
  });
}

describe("useUpdateListingMarketConfig", () => {
  afterEach(() => {
    updateListingMarketConfigMutationOptions.mockReset();
  });

  it("forwards the variables and defaults chainId to the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(UPDATED);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useUpdateListingMarketConfig({ config }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: hyperEvm.id });
  });

  it("forwards an explicit chainId override unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(UPDATED);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useUpdateListingMarketConfig({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...VARIABLES, chainId: base.id });
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: base.id });
  });

  it("forwards a single knob without inventing the other", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(UPDATED);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useUpdateListingMarketConfig({ config }));

    await act(async () => {
      await result.current.mutateAsync({
        accessToken: VARIABLES.accessToken,
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
        buybackRatio: 0,
      });
    });

    const variables = mutationFn.mock.calls[0]?.[0];
    expect(variables).not.toHaveProperty("maxLeverage");
    expect(variables).toMatchObject({ buybackRatio: 0 });
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("update failed")));

    const { result } = renderHookWithProviders(() => useUpdateListingMarketConfig({ config }));

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
