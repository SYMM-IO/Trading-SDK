import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateDeleteSubAccount } from "./use-simulate-delete-sub-account";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useSimulateDeleteSubAccount", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateDeleteSubAccount({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates and resolves on success", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateDeleteSubAccount({ config }));

    await act(async () => {
      await result.current.mutateAsync({ subAccount: SUB_ACCOUNT });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "deleteSubAccount", args: [SUB_ACCOUNT] }),
    );
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateDeleteSubAccount({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ subAccount: SUB_ACCOUNT });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
