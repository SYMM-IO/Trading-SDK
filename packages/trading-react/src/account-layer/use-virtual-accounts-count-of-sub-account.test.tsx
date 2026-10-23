import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useVirtualAccountsCountOfSubAccount } from "./use-virtual-accounts-count-of-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

describe("useVirtualAccountsCountOfSubAccount", () => {
  it("is disabled while `subAccount` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useVirtualAccountsCountOfSubAccount({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the subaccount's VA count", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(2n);

    const { result } = renderHookWithProviders(() =>
      useVirtualAccountsCountOfSubAccount({ subAccount: TEST_EOA, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getVirtualAccountsCountOfSubAccount",
        args: [TEST_EOA],
      }),
    );
  });
});
