import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateEditAccountName } from "./use-simulate-edit-account-name";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useSimulateEditAccountName", () => {
  it("stays disabled until account and name are present", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateEditAccountName({ config, account: ACCOUNT }));

    expect(result.current.fetchStatus).toBe("idle");
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("succeeds with defined data even when the call returns nothing", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() =>
      useSimulateEditAccountName({ config, account: ACCOUNT, name: "Renamed" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "editAccountName", args: [ACCOUNT, "Renamed"] }),
    );
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() =>
      useSimulateEditAccountName({ config, account: ACCOUNT, name: "Renamed" }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as SymmioRequestError).kind).toBe("unknown");
  });
});
