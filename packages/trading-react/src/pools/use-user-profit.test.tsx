import type { GetUserProfitReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getUserProfitQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getUserProfitQueryOptions };
});

import { useUserProfit } from "./use-user-profit";

const PROFIT: GetUserProfitReturnType = {
  userBalanceInTokens: 1000000000000000000n,
  userBalanceInUsdc: 5000000000000000000n,
  claimableReward: 250000000000000000n,
  claimedReward: 100000000000000000n,
  userDepositedTokenAmount: 900000000000000000n,
  userLpAmount: 750000000000000000n,
  pendingWithdrawLpAmount: 50000000000000000n,
  availableLpAmount: 700000000000000000n,
};

const TOKEN_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

function mockOptions(queryFn: () => Promise<unknown>) {
  getUserProfitQueryOptions.mockReturnValue({
    queryKey: ["getUserProfit", {}],
    enabled: true,
    queryFn,
  });
}

describe("useUserProfit", () => {
  afterEach(() => {
    getUserProfitQueryOptions.mockReset();
  });

  it("forwards the access token, token address and connected chain into the core query options and returns the profit", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PROFIT));

    const { result } = renderHookWithProviders(() =>
      useUserProfit({ config, accessToken: "tok-abc", tokenContractAddress: TOKEN_ADDRESS }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PROFIT);
    expect(getUserProfitQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        accessToken: "tok-abc",
        tokenContractAddress: TOKEN_ADDRESS,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle when the access token is empty", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(PROFIT);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useUserProfit({ config, accessToken: "", tokenContractAddress: TOKEN_ADDRESS }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isPending).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("stays idle when the token contract address is empty", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(PROFIT);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useUserProfit({ config, accessToken: "tok-abc", tokenContractAddress: "" }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isPending).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() =>
      useUserProfit({ config, accessToken: "tok-abc", tokenContractAddress: TOKEN_ADDRESS }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
