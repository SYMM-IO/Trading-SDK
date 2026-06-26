import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useCollateralBalance } from "./use-collateral-balance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("useCollateralBalance", () => {
  it("is disabled while `owner` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useCollateralBalance({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the owner's collateral-token balance", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(123n);

    const { result } = renderHookWithProviders(() => useCollateralBalance({ owner: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(123n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "balanceOf",
        args: [TEST_EOA],
      }),
    );
  });
});
