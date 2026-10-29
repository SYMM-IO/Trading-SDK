import { accountLayerAbi, symmioAbi, TimelockBatchExecutionError, TimelockExecutionError } from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { encodeFunctionData, getAbiItem, keccak256, toFunctionSelector, zeroAddress, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA, TEST_TX_HASH } from "../test/test-utils";
import { useAddMargin } from "./use-add-margin";
import { useExecuteAccountCalls } from "./use-execute-account-calls";

const ROOT = "0x2222222222222222222222222222222222222222" as const;
const VA = "0x3333333333333333333333333333333333333333" as const;
const UNLOCKER = "0x4444444444444444444444444444444444444444" as const;

describe("protected margin confirmation", () => {
  it("preserves the approval and hash on receipt failure without repeating submission", async () => {
    const f = createMockSymmioConfig();
    f.readContract.mockImplementation(({ functionName }) => {
      if (functionName === "getVirtualAccount") return { isExists: true, parentAccount: ROOT };
      if (functionName === "getSubAccount") return { isExists: true, owner: TEST_EOA };
      if (functionName === "getSelectorTimelock") return { unlocker: UNLOCKER, delay: 600n };
      throw new Error(`Unexpected read ${functionName}`);
    });
    f.simulateContract.mockResolvedValue({ request: {} });
    f.writeContract.mockResolvedValue(TEST_TX_HASH);
    f.waitForTransactionReceipt.mockRejectedValue(new Error("receipt timeout"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } },
    });
    const callData = encodeFunctionData({ abi: accountLayerAbi, functionName: "addMargin", args: [VA, 12n] });
    const approval = {
      approval: {
        account: ROOT,
        unlocker: UNLOCKER,
        callDataHash: keccak256(callData),
        deadline: 2_000_000_000n,
        salt: `0x${"11".repeat(32)}` as Hex,
      },
      signature: "0x1234" as Hex,
    };
    const { result } = renderHookWithProviders(() => useAddMargin({ config: f.config }), { queryClient });
    let caught: unknown;
    try {
      await result.current.mutateAsync({ virtualAccount: VA, amount: 12n, gasless: false, timelock: { approval } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ cause: expect.any(TimelockExecutionError) });
    expect((caught as Error).cause).toMatchObject({ hash: TEST_TX_HASH, approval, callData });
    expect(f.writeContract).toHaveBeenCalledOnce();
  });

  it("preserves both batch approvals when receipt confirmation fails", async () => {
    const f = createMockSymmioConfig();
    const outer = toFunctionSelector(getAbiItem({ abi: accountLayerAbi, name: "_call" }));
    f.readContract.mockImplementation(({ functionName, args }) => {
      if (functionName === "getVirtualAccount") return { isExists: true, parentAccount: ROOT };
      if (functionName === "getSubAccount") return { isExists: true, owner: TEST_EOA };
      if (functionName === "getSelectorTimelock")
        return { unlocker: args[1] === outer ? zeroAddress : UNLOCKER, delay: 600n };
      throw new Error(`Unexpected read ${functionName}`);
    });
    f.simulateContract.mockResolvedValue({ request: {} });
    f.writeContract.mockResolvedValue(TEST_TX_HASH);
    f.waitForTransactionReceipt.mockRejectedValue(new Error("receipt timeout"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } },
    });
    const calls = [12n, 13n].map((amount) => ({ functionName: "allocate", args: [amount] }));
    const approvals = [12n, 13n].map((amount, index) => ({
      approval: {
        account: ROOT,
        unlocker: UNLOCKER,
        callDataHash: keccak256(encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [amount] })),
        deadline: 2_000_000_000n,
        salt: `0x${String(index + 1).repeat(64)}` as Hex,
      },
      signature: "0x1234" as Hex,
    }));
    const { result } = renderHookWithProviders(() => useExecuteAccountCalls({ config: f.config }), { queryClient });
    let caught: unknown;
    try {
      await result.current.mutateAsync({
        account: VA,
        calls,
        gasless: false,
        timelock: { calls: approvals.map((approval) => ({ approval })) },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ cause: expect.any(TimelockBatchExecutionError) });
    expect((caught as Error).cause).toMatchObject({ hash: TEST_TX_HASH, approvals });
    expect(f.writeContract).toHaveBeenCalledOnce();
  });
});
