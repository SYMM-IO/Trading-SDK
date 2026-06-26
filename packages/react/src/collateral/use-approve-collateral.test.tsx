import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useApproveCollateral } from "./use-approve-collateral";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("useApproveCollateral", () => {
  it("approves the collateral token for the SYMMIO core", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useApproveCollateral({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ amount: 5_000000n });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, 5_000000n],
      }),
    );
  });
});
