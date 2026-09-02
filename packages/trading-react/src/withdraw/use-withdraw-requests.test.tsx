import { getChainConfig, SymmioSupportedChainId, WithdrawStatus } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useWithdrawRequest } from "./use-withdraw-requests";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const REQUEST_ID = 1n;

describe("useWithdrawRequest", () => {
  it("is disabled while `user` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useWithdrawRequest({ requestId: REQUEST_ID, config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads a single withdraw request from the SYMMIO core by user and request id", async () => {
    const { config, readContract } = createMockSymmioConfig();
    const request = {
      id: REQUEST_ID,
      user: SUB_ACCOUNT,
      parts: [],
      timestamp: 0n,
      cooldownEndTime: 0n,
      status: WithdrawStatus.PENDING,
      speedUp: false,
      isCooldownModified: false,
      provider: "0x0000000000000000000000000000000000000000",
      isPureVirtual: false,
      providerData: "0x",
      totalAmount: 1_000000n,
      totalVirtualAmount: 0n,
    };
    readContract.mockResolvedValueOnce(request);

    const { result } = renderHookWithProviders(() =>
      useWithdrawRequest({ user: SUB_ACCOUNT, requestId: REQUEST_ID, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getWithdrawRequests",
        args: [SUB_ACCOUNT, REQUEST_ID],
      }),
    );
    /** HyperEVM is a v0.8.5 chain — the legacy decode has no `advancedAmount`, and none is fabricated. */
    expect(result.current.data).toEqual(request);
    expect(result.current.data?.advancedAmount).toBeUndefined();
  });
});
