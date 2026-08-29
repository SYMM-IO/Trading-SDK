import { ListingDepositChainId } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { base, hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const claimProfitMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, claimProfitMutationOptions };
});

import { useClaimProfit } from "./use-claim-profit";

const RECEIPT = {
  status: "ok",
  amountClaimed: 1000000000000000000n,
  claimRequestId: "claim-1",
  transactionHash: null,
};

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  depositChain: ListingDepositChainId.HYPER_EVM,
  accountAddress: "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A",
  amount: 1000000000000000000n,
} as const;

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  claimProfitMutationOptions.mockReturnValue({ mutationKey: ["claimProfit"], mutationFn });
}

describe("useClaimProfit", () => {
  afterEach(() => {
    claimProfitMutationOptions.mockReset();
  });

  it("forwards the variables and defaults chainId to the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(RECEIPT);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useClaimProfit({ config }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: hyperEvm.id });
  });

  it("forwards an explicit chainId override unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(RECEIPT);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useClaimProfit({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...VARIABLES, chainId: base.id });
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: base.id });
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("claim failed")));

    const { result } = renderHookWithProviders(() => useClaimProfit({ config }));

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
