import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateDeposit } from "./use-simulate-deposit";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useSimulateDeposit", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateDeposit({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates depositForAccount and returns the dry-run result", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateDeposit({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: 1_000000n });
    });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "depositForAccount", args: [SUB_ACCOUNT, 1_000000n] }),
    );
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateDeposit({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: 1_000000n });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
