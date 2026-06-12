import { getChainConfig, SymmioSupportedChainId } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useVirtualAccountsAddressesOfSubAccount } from "./use-virtual-accounts-addresses-of-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("useVirtualAccountsAddressesOfSubAccount", () => {
  it("is disabled while `subAccount` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useVirtualAccountsAddressesOfSubAccount({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the subaccount's VA addresses with default pagination", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([]);

    const { result } = renderHookWithProviders(() =>
      useVirtualAccountsAddressesOfSubAccount({ subAccount: TEST_EOA, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getVirtualAccountsAddressesOfSubAccount",
        args: [TEST_EOA, 0n, 200n],
      }),
    );
  });
});
