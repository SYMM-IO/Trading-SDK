import { act } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateGrantDelegations } from "./use-simulate-grant-delegations";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

const VARS = {
  account: { addr: ACCOUNT, isPartyB: false },
  delegations: [{ delegatedSigner: DELEGATE, selectors: [SELECTOR], expiryTimestamp: 456n }],
} as const;

describe("useSimulateGrantDelegations", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateGrantDelegations({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates grantDelegations and returns the dry-run result", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateGrantDelegations({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toBeDefined();
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "grantDelegations",
        args: [[{ account: VARS.account, delegatedSigner: DELEGATE, selectors: [SELECTOR], expiryTimestamp: 456n }]],
      }),
    );
  });
});
