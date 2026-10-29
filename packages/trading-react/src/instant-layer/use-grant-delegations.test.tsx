import { act } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useGrantDelegations } from "./use-grant-delegations";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION_KEY: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const EXECUTOR: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const SELECTOR: Hex = "0x12345678";

const VARIABLES = {
  account: { addr: ACCOUNT, isPartyB: false },
  delegations: [
    { delegatedSigner: SESSION_KEY, selectors: [SELECTOR], expiryTimestamp: 456n },
    { delegatedSigner: EXECUTOR, selectors: [SELECTOR], expiryTimestamp: 789n },
  ],
} as const;

describe("useGrantDelegations", () => {
  it("writes one grantDelegations call and returns the tx hash", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useGrantDelegations({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARIABLES);
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(writeContract).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "grantDelegations",
        args: [
          [
            { account: VARIABLES.account, delegatedSigner: SESSION_KEY, selectors: [SELECTOR], expiryTimestamp: 456n },
            { account: VARIABLES.account, delegatedSigner: EXECUTOR, selectors: [SELECTOR], expiryTimestamp: 789n },
          ],
        ],
      }),
    );
  });

  it("surfaces an empty grant as a normalized validation error without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useGrantDelegations({ config, waitForReceipt: false }));

    await expect(result.current.mutateAsync({ ...VARIABLES, delegations: [] })).rejects.toMatchObject({
      kind: "sdk",
      code: "GRANT_DELEGATIONS_EMPTY",
    });
    expect(writeContract).not.toHaveBeenCalled();
  });
});
