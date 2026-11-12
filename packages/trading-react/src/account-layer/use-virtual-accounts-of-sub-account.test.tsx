import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useVirtualAccountsOfSubAccount } from "./use-virtual-accounts-of-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

describe("useVirtualAccountsOfSubAccount", () => {
  it("is disabled while `subAccount` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useVirtualAccountsOfSubAccount({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the subaccount's VA details with default pagination", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([]);

    const { result } = renderHookWithProviders(() => useVirtualAccountsOfSubAccount({ subAccount: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getVirtualAccountsOfSubAccount",
        args: [TEST_EOA, 0n, 200n],
      }),
    );
  });
});
