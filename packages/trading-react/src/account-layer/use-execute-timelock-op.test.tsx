import {
  accountLayerAbi,
  encodeTimelockedCoreCall,
  getAccountBalanceOfQueryKey,
  getInstantLayerNonceQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getSubAccountQueryKey,
  getSubAccountsCountOfUserQueryKey,
  getTimelockScheduleStateQueryKey,
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsQueryKey,
  symmioAbi,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { encodeFunctionData, UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA, TEST_TX_HASH } from "../test/test-utils";
import { useExecuteTimelockOp } from "./use-timelock";

const ROOT = "0x2222222222222222222222222222222222222222";
const deletion = encodeFunctionData({ abi: accountLayerAbi, functionName: "deleteSubAccount", args: [ROOT] });

function fixture() {
  const mocks = createMockSymmioConfig();
  mocks.readContract.mockResolvedValue({ isExists: false });
  mocks.simulateContract.mockResolvedValue({ request: {} });
  mocks.writeContract.mockResolvedValue(TEST_TX_HASH);
  mocks.waitForTransactionReceipt.mockResolvedValue({ status: "success", transactionHash: TEST_TX_HASH });
  const scope = { configKey: mocks.config.getChainConfigKey() };
  const accountKeys = [
    getUserSubAccountsQueryKey({ ...scope, user: TEST_EOA }),
    getUserSubAccountsAddressesQueryKey({ ...scope, user: TEST_EOA }),
    getSubAccountsCountOfUserQueryKey({ ...scope, user: TEST_EOA }),
    getSubAccountQueryKey({ ...scope, account: ROOT }),
  ];
  const schedule = getTimelockScheduleStateQueryKey({ ...scope, account: ROOT, callData: deletion });
  const withdrawal = getPendingWithdrawRequestsQueryKey({ ...scope, user: ROOT });
  const balance = getAccountBalanceOfQueryKey({ ...scope, account: ROOT });
  const otherDeployment = getUserSubAccountsQueryKey({ configKey: "another-deployment", user: TEST_EOA });
  const nonce = getInstantLayerNonceQueryKey({ ...scope, account: ROOT });
  const keys = [...accountKeys, schedule, withdrawal, balance, otherDeployment, nonce];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } },
  });
  for (const key of keys) queryClient.setQueryData(key, 0n);
  return { ...mocks, queryClient, accountKeys, schedule, withdrawal, balance, otherDeployment, nonce, keys };
}

const variables = { account: ROOT, innerCallData: deletion, gasless: false } as const;

describe("useExecuteTimelockOp cache effects", () => {
  it("refreshes deleted sub-account reads only in the confirmed deployment", async () => {
    const f = fixture();
    const { result } = renderHookWithProviders(() => useExecuteTimelockOp({ config: f.config }), {
      queryClient: f.queryClient,
    });
    await result.current.mutateAsync(variables);
    for (const key of [...f.accountKeys, f.schedule, f.balance]) {
      expect(f.queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
    for (const key of [f.otherDeployment, f.withdrawal, f.nonce]) {
      expect(f.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    }
    expect(f.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "executeTimelockOp",
        args: [[], deletion],
      }),
    );
    expect(f.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "executeTimelockOp",
        args: [[], deletion],
      }),
    );
  });

  it("refreshes withdrawal reads through the Core wrapper", async () => {
    const f = fixture();
    const raw = encodeFunctionData({ abi: symmioAbi, functionName: "requestCancelWithdraw", args: [1n] });
    const { result } = renderHookWithProviders(() => useExecuteTimelockOp({ config: f.config }), {
      queryClient: f.queryClient,
    });
    await result.current.mutateAsync({ ...variables, innerCallData: encodeTimelockedCoreCall(ROOT, raw) });
    expect(f.queryClient.getQueryState(f.withdrawal)?.isInvalidated).toBe(true);
    for (const key of f.accountKeys) expect(f.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it.each(["simulation", "rejection", "revert", "timeout"] as const)(
    "does not refresh or repeat deletion after %s",
    async (failure) => {
      const f = fixture();
      if (failure === "simulation") f.simulateContract.mockRejectedValue(new Error("SubAccountNotEmpty"));
      if (failure === "rejection")
        f.writeContract.mockRejectedValue(new UserRejectedRequestError(new Error("Rejected")));
      if (failure === "revert")
        f.waitForTransactionReceipt.mockResolvedValue({ status: "reverted", transactionHash: TEST_TX_HASH });
      if (failure === "timeout") f.waitForTransactionReceipt.mockRejectedValue(new Error("receipt timeout"));
      const { result } = renderHookWithProviders(() => useExecuteTimelockOp({ config: f.config }), {
        queryClient: f.queryClient,
      });
      await expect(result.current.mutateAsync(variables)).rejects.toThrow();
      for (const key of f.keys) expect(f.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
      expect(f.writeContract).toHaveBeenCalledTimes(failure === "simulation" ? 0 : 1);
      expect(f.waitForTransactionReceipt).toHaveBeenCalledTimes(
        failure === "simulation" || failure === "rejection" ? 0 : 1,
      );
    },
  );

  it("does not refresh deletion reads when receipt waiting is disabled", async () => {
    const f = fixture();
    const { result } = renderHookWithProviders(
      () => useExecuteTimelockOp({ config: f.config, waitForReceipt: false }),
      {
        queryClient: f.queryClient,
      },
    );
    const value = await result.current.mutateAsync(variables);
    expect(value.receipt).toBeUndefined();
    expect(f.waitForTransactionReceipt).not.toHaveBeenCalled();
    for (const key of f.keys) expect(f.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it("waits for the deletion receipt before refreshing account reads", async () => {
    const f = fixture();
    const receipt = { status: "success", transactionHash: TEST_TX_HASH } as const;
    let confirm!: (value: typeof receipt) => void;
    f.waitForTransactionReceipt.mockReturnValue(
      new Promise<typeof receipt>((resolve) => {
        confirm = resolve;
      }),
    );
    const { result } = renderHookWithProviders(() => useExecuteTimelockOp({ config: f.config }), {
      queryClient: f.queryClient,
    });
    const pending = result.current.mutateAsync(variables);
    await waitFor(() => expect(f.waitForTransactionReceipt).toHaveBeenCalledOnce());
    for (const key of f.accountKeys) expect(f.queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    confirm(receipt);
    await pending;
    for (const key of f.accountKeys) expect(f.queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
