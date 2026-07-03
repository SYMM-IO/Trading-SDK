import { act, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useGrantDelegation } from "./use-grant-delegation";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

describe("useGrantDelegation", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });
    const { result } = renderHookWithProviders(() => useGrantDelegation({ config, waitForReceipt: false }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          account: { addr: ACCOUNT, isPartyB: false },
          delegatedSigner: DELEGATE,
          selectors: [SELECTOR],
          expiryTimestamp: 456n,
        });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes and returns the tx hash when waitForReceipt is false", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useGrantDelegation({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({
        account: { addr: ACCOUNT, isPartyB: false },
        delegatedSigner: DELEGATE,
        selectors: [SELECTOR],
        expiryTimestamp: 456n,
      });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(writeContract).toHaveBeenCalledWith(
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

  it("waits for the receipt by default", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });

    const { result } = renderHookWithProviders(() => useGrantDelegation({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({
        account: { addr: ACCOUNT, isPartyB: false },
        delegatedSigner: DELEGATE,
        selectors: [SELECTOR],
        expiryTimestamp: 456n,
      });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH, receipt: { status: "success" } });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
  });
});
