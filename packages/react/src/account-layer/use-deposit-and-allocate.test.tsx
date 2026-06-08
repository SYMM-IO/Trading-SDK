import type { DepositAndAllocateForAccountParameters } from "@symm-frontier/core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useDepositAndAllocate } from "./use-deposit-and-allocate";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const VARS: DepositAndAllocateForAccountParameters = { account: SUB_ACCOUNT, amount: 1_000000n };

describe("useDepositAndAllocate", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });
    const { result } = renderHookWithProviders(() => useDepositAndAllocate({ config, waitForReceipt: false }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARS);
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes depositAndAllocateForAccount and returns the tx hash when waitForReceipt is false", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useDepositAndAllocate({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "depositAndAllocateForAccount", args: [SUB_ACCOUNT, 1_000000n] }),
    );
  });

  it("waits for the receipt by default", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });

    const { result } = renderHookWithProviders(() => useDepositAndAllocate({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toEqual({ hash: TEST_TX_HASH, receipt: { status: "success" } });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
  });
});
