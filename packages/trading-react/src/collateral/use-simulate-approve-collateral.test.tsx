import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateApproveCollateral } from "./use-simulate-approve-collateral";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("useSimulateApproveCollateral", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateApproveCollateral({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates the approve and returns the dry-run result", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: true, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateApproveCollateral({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ amount: 5_000000n });
    });

    expect((res as { result: unknown }).result).toBe(true);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, 5_000000n],
      }),
    );
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateApproveCollateral({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ amount: 5_000000n });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
