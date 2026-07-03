import { createClassicWithdrawPart, getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useInitiateWithdraw } from "./use-initiate-withdraw";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xdddddddddddddddddddddddddddddddddddddddd";

const PARTS = [createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: RECEIVER, chainId: 999n })];

describe("useInitiateWithdraw", () => {
  it("routes the core call through the AccountLayer `_call` proxy", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useInitiateWithdraw({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, parts: PARTS });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    const call = writeContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args[0]).toBe(SUB_ACCOUNT);
    expect(call.args[1]).toHaveLength(1);
  });
});
