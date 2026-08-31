import { ListingDepositChainId } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { base, hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const refundMarketMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, refundMarketMutationOptions };
});

import { useRefundMarket } from "./use-refund-market";

const RECEIPT = { transactionHash: "0xabc" };

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  marketAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
  recipientAddress: "0xRecipient",
} as const;

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  refundMarketMutationOptions.mockReturnValue({ mutationKey: ["refundMarket"], mutationFn });
}

describe("useRefundMarket", () => {
  afterEach(() => {
    refundMarketMutationOptions.mockReset();
  });

  it("forwards the variables and defaults chainId to the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(RECEIPT);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useRefundMarket({ config }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: hyperEvm.id });
  });

  it("forwards an explicit chainId override unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(RECEIPT);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useRefundMarket({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...VARIABLES, chainId: base.id });
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: base.id });
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("refund failed")));

    const { result } = renderHookWithProviders(() => useRefundMarket({ config }));

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
