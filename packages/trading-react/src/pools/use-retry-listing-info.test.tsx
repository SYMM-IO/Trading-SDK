import { ListingDepositChainId, type GetRetryListingInfoReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getRetryListingInfoQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getRetryListingInfoQueryOptions };
});

import { useRetryListingInfo } from "./use-retry-listing-info";

const INFO: GetRetryListingInfoReturnType = { retryLimit: 3, remainingRetries: 2, remainingCooldownSeconds: null };

function mockOptions(queryFn: () => Promise<unknown>) {
  getRetryListingInfoQueryOptions.mockReturnValue({ queryKey: ["getRetryListingInfo", {}], enabled: true, queryFn });
}

describe("useRetryListingInfo", () => {
  afterEach(() => {
    getRetryListingInfoQueryOptions.mockReset();
  });

  it("forwards the market params and returns the retry allowance", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(INFO));

    const { result } = renderHookWithProviders(() =>
      useRetryListingInfo({
        config,
        accessToken: "t",
        tokenContractAddress: "0xToken",
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(INFO);
    expect(getRetryListingInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ tokenContractAddress: "0xToken", chainId: expect.any(Number) }),
    );
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() =>
      useRetryListingInfo({
        config,
        accessToken: "t",
        tokenContractAddress: "0xToken",
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
