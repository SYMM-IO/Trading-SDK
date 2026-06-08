import { getChainConfig, SymmioSupportedChainId } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useWithdrawableTime } from "./use-withdrawable-time";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useWithdrawableTime", () => {
  it("is disabled while `user` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useWithdrawableTime({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the withdrawable time from the SYMMIO core for the subaccount", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(1_700000000n);

    const { result } = renderHookWithProviders(() => useWithdrawableTime({ user: SUB_ACCOUNT, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getWithdrawableTime",
        args: [SUB_ACCOUNT],
      }),
    );
    expect(result.current.data).toBe(1_700000000n);
  });
});
