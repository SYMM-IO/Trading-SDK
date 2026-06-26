import { SubAccountIsolationType, type SubAccountCreationData } from "@theoldvarorg/core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateCreateSubAccounts } from "./use-simulate-create-sub-accounts";

const AFFILIATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SYMMIO_CORE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

const ACCOUNTS_DATA: readonly SubAccountCreationData[] = [
  {
    name: "Main",
    metadata: "0x",
    symmioCore: SYMMIO_CORE,
    isolationType: SubAccountIsolationType.MARKET_DIRECTION,
    singleVAMode: true,
  },
];

describe("useSimulateCreateSubAccounts", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateCreateSubAccounts({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates and returns the dry-run result", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: [SYMMIO_CORE], request: {} });

    const { result } = renderHookWithProviders(() => useSimulateCreateSubAccounts({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA });
    });

    expect((res as { result: unknown }).result).toEqual([SYMMIO_CORE]);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "createSubAccounts", args: [AFFILIATE, ACCOUNTS_DATA] }),
    );
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateCreateSubAccounts({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
