import { act, waitFor } from "@testing-library/react";
import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useRequestCancelWithdraw } from "./use-request-cancel-withdraw";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const REQUEST_ID = 1n;

describe("useRequestCancelWithdraw", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });

    const { result } = renderHookWithProviders(() => useRequestCancelWithdraw({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, requestId: REQUEST_ID });
      } catch (err) {
        error = err;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes _call and returns the tx hash when waitForReceipt is false", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useRequestCancelWithdraw({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, requestId: REQUEST_ID });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    const call = writeContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args[0]).toBe(SUB_ACCOUNT);
    expect(call.args[1]).toHaveLength(1);
  });

  it("waits for the receipt by default", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });

    const { result } = renderHookWithProviders(() => useRequestCancelWithdraw({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, requestId: REQUEST_ID });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH, receipt: { status: "success" } });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
  });
});
