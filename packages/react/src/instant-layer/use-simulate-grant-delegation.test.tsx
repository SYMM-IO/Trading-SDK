import { act, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateGrantDelegation } from "./use-simulate-grant-delegation";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

const VARS = {
  account: { addr: ACCOUNT, isPartyB: false },
  delegatedSigner: DELEGATE,
  selectors: [SELECTOR],
  expiryTimestamp: 456n,
} as const;

describe("useSimulateGrantDelegation", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateGrantDelegation({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates grantDelegation and returns the dry-run result", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateGrantDelegation({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "grantDelegation",
        args: [
          {
            account: { addr: ACCOUNT, isPartyB: false },
            delegatedSigner: DELEGATE,
            selectors: [SELECTOR],
            expiryTimestamp: 456n,
          },
        ],
      }),
    );
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateGrantDelegation({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARS);
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
