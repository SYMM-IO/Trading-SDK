import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { usePendingWithdrawRequests } from "./use-pending-withdraw-requests";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("usePendingWithdrawRequests", () => {
  it("is disabled while `user` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => usePendingWithdrawRequests({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads pending requests from the SYMMIO core with default pagination", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([]);

    const { result } = renderHookWithProviders(() => usePendingWithdrawRequests({ user: SUB_ACCOUNT, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getPendingWithdrawRequests",
        args: [SUB_ACCOUNT, 1n, 200n],
      }),
    );
  });
});
