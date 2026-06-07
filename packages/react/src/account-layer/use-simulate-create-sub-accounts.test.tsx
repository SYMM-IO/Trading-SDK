import { SubAccountIsolationType, type SubAccountCreationData } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
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
  it("stays disabled until inputs are present", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateCreateSubAccounts({ config }));

    expect(result.current.fetchStatus).toBe("idle");
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates and returns the dry-run result", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: [SYMMIO_CORE], request: {} });

    const { result } = renderHookWithProviders(() =>
      useSimulateCreateSubAccounts({ config, affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.result).toEqual([SYMMIO_CORE]);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "createSubAccounts", args: [AFFILIATE, ACCOUNTS_DATA] }),
    );
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() =>
      useSimulateCreateSubAccounts({ config, affiliate: AFFILIATE, accountsData: ACCOUNTS_DATA }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as SymmioRequestError).kind).toBe("unknown");
  });
});
