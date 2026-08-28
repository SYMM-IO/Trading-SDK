import { ListingDepositChainId, ListingMarketStatus, type GetDepositAddressReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getDepositAddressQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getDepositAddressQueryOptions };
});

import { useDepositAddress } from "./use-deposit-address";

const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

const DEPOSIT: GetDepositAddressReturnType = {
  tokenContractAddress: TOKEN_ADDRESS,
  userAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  depositChain: ListingDepositChainId.HYPER_EVM,
  depositAddress: "0x1111111111111111111111111111111111111111",
  tokenDecimal: 18,
  marketStatus: ListingMarketStatus.LISTED,
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getDepositAddressQueryOptions.mockReturnValue({
    queryKey: ["getDepositAddress", {}],
    enabled: true,
    queryFn,
  });
}

describe("useDepositAddress", () => {
  afterEach(() => {
    getDepositAddressQueryOptions.mockReset();
  });

  it("forwards the access token, token address, deposit chain and connected chain into the core query options and returns the deposit address", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(DEPOSIT));

    const { result } = renderHookWithProviders(() =>
      useDepositAddress({
        config,
        accessToken: "tok-abc",
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(DEPOSIT);
    expect(getDepositAddressQueryOptions).toHaveBeenCalledWith(
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
    const queryFn = vi.fn().mockResolvedValue(DEPOSIT);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useDepositAddress({
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
    const queryFn = vi.fn().mockResolvedValue(DEPOSIT);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useDepositAddress({
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
      useDepositAddress({
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
