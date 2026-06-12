import { getChainConfig, SymmioSupportedChainId } from "@symm-frontier/core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useAddMargin } from "./use-add-margin";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const VIRTUAL_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AMOUNT = 50_000000000000000000n;

describe("useAddMargin", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });

    const { result } = renderHookWithProviders(() => useAddMargin({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });
      } catch (err) {
        error = err;
      }
    });

    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes addMargin and returns the tx hash when waitForReceipt is false", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useAddMargin({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    const call = writeContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("addMargin");
    expect(call.args).toEqual([VIRTUAL_ACCOUNT, AMOUNT]);
  });

  it("waits for the receipt by default", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });

    const { result } = renderHookWithProviders(() => useAddMargin({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH, receipt: { status: "success" } });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
  });
});
