import { getChainConfig, SymmioSupportedChainId } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useCollateralAllowance } from "./use-collateral-allowance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("useCollateralAllowance", () => {
  it("is disabled while `owner` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useCollateralAllowance({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the owner's allowance to the SYMMIO core", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(123n);

    const { result } = renderHookWithProviders(() => useCollateralAllowance({ owner: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(123n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "allowance",
        args: [TEST_EOA, DEFAULT.addresses.symmioAddress],
      }),
    );
  });
});
