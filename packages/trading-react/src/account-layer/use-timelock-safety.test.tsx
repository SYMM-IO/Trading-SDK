import {
  EarlyWithdrawExecutionError,
  getTimelockPolicyQueryKey,
  SymmApiError,
  type EarlyWithdrawParameters,
  type EarlyWithdrawResult,
  type TimelockApprovalCapability,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { UserRejectedRequestError } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA, TEST_TX_HASH } from "../test/test-utils";
import { TransactionRevertedError } from "../transactions";
import { useScheduleTimelockOp } from "./use-timelock";
import { useEarlyWithdraw, useSetupTimelockPolicy } from "./use-timelock-policy";

const { early, setup } = vi.hoisted(() => ({ early: vi.fn(), setup: vi.fn() }));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    earlyWithdrawMutationOptions: (...args: Parameters<typeof actual.earlyWithdrawMutationOptions>) => ({
      ...actual.earlyWithdrawMutationOptions(...args),
      mutationFn: early,
    }),
    setupTimelockPolicyMutationOptions: (...args: Parameters<typeof actual.setupTimelockPolicyMutationOptions>) => ({
      ...actual.setupTimelockPolicyMutationOptions(...args),
      mutationFn: setup,
    }),
  };
});

const ROOT = "0x2222222222222222222222222222222222222222";
const VA = "0x3333333333333333333333333333333333333333";
const HASH = `0x${"11".repeat(32)}` as const;
const capability: TimelockApprovalCapability = {
  unlocker: TEST_EOA,
  validitySeconds: 60,
  minTimelockDelaySeconds: 600,
  requestDomain: { name: "SymmioTimelockApprovalRequest", version: "1", chainId: 42161, verifyingContract: TEST_EOA },
};
const submitted: EarlyWithdrawResult = {
  hash: TEST_TX_HASH,
  rootAccount: ROOT,
  callData: "0x12345678",
  approval: {
    signedApproval: {
      approval: { account: ROOT, unlocker: TEST_EOA, callDataHash: HASH, deadline: 2_000_000_000n, salt: HASH },
      signature: "0x12",
    },
    approvalHash: HASH,
    remainingApprovals: 1,
    request: {
      operation: {
        signer: TEST_EOA,
        target: TEST_EOA,
        callData: "0x12345678",
        signerAccount: { addr: VA, isPartyB: false },
        flexFields: [],
        maxUses: 1n,
        replayAttackHeader: { nonce: 0n, deadline: 2_000_000_000n, salt: HASH },
      },
      request: {
        signedOperation: {
          signer: TEST_EOA,
          target: TEST_EOA,
          callData: "0x12345678",
          signerAccount: { addr: VA, isPartyB: false },
          flexFields: [],
          maxUses: "1",
          replayAttackHeader: { nonce: "0", deadline: "2000000000", salt: HASH },
        },
        signature: "0x12",
      },
    },
  },
};
function clientWithRetries() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } } });
}

function withdrawalParameters(): EarlyWithdrawParameters {
  return { account: VA, capability, withdrawal: { method: "withdraw" as const, amount: 5n }, deadline: 2_000_000_000n };
}

describe("timelock mutation safety", () => {
  beforeEach(() => {
    early.mockReset();
    setup.mockReset();
  });
  it("preserves the mined revert type and recovery data without invalidating balances or retrying", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    early.mockResolvedValue(submitted);
    waitForTransactionReceipt.mockResolvedValue({ status: "reverted", transactionHash: TEST_TX_HASH });
    const queryClient = clientWithRetries();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHookWithProviders(() => useEarlyWithdraw({ config }), { queryClient });
    const failure = await result.current.mutateAsync(withdrawalParameters()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TransactionRevertedError);
    expect(failure).toMatchObject({
      kind: "contract-revert",
      code: "TRANSACTION_REVERTED",
      hash: TEST_TX_HASH,
      receipt: { status: "reverted" },
      cause: { approval: submitted.approval, callData: submitted.callData, hash: TEST_TX_HASH },
    });
    expect(early).toHaveBeenCalledOnce();
    expect(waitForTransactionReceipt).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each(["submission", "confirmation"] as const)(
    "preserves a relay rejection during %s with its recovery context",
    async (stage) => {
      const { config, waitForTransactionReceipt } = createMockSymmioConfig();
      const responseData = { requestId: "relay-id", status: "rejected" };
      const relayError = new SymmApiError({
        code: "GASLESS_RELAY_REJECTED",
        message: "Relay rejected",
        status: 400,
        statusText: "Bad Request",
        responseData,
        url: "https://relay.example",
        method: "POST",
      });
      if (stage === "submission")
        early.mockRejectedValue(new EarlyWithdrawExecutionError(submitted.approval, submitted.callData, relayError));
      else {
        early.mockResolvedValue(submitted);
        waitForTransactionReceipt.mockRejectedValue(relayError);
      }
      const { result } = renderHookWithProviders(() => useEarlyWithdraw({ config }), {
        queryClient: clientWithRetries(),
      });
      await expect(result.current.mutateAsync(withdrawalParameters())).rejects.toMatchObject({
        kind: "api",
        code: "GASLESS_RELAY_REJECTED",
        status: 400,
        responseData,
        cause: { approval: submitted.approval, callData: submitted.callData, cause: relayError },
      });
      expect(early).toHaveBeenCalledOnce();
      expect(waitForTransactionReceipt).toHaveBeenCalledTimes(stage === "submission" ? 0 : 1);
    },
  );

  it("keeps wallet rejection classified while retaining the issued approval", async () => {
    const { config } = createMockSymmioConfig();
    early.mockRejectedValue(
      new EarlyWithdrawExecutionError(
        submitted.approval,
        submitted.callData,
        new UserRejectedRequestError(new Error("Rejected")),
      ),
    );
    const { result } = renderHookWithProviders(() => useEarlyWithdraw({ config }), {
      queryClient: clientWithRetries(),
    });
    await expect(result.current.mutateAsync(withdrawalParameters())).rejects.toMatchObject({
      kind: "user-rejected",
      cause: { approval: submitted.approval, callData: submitted.callData },
    });
    expect(early).toHaveBeenCalledOnce();
  });
  it("does not repeat issuance after a receipt timeout, even with global retries", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    early.mockResolvedValue(submitted);
    waitForTransactionReceipt.mockRejectedValue(new Error("receipt timeout"));
    const { result } = renderHookWithProviders(() => useEarlyWithdraw({ config }), {
      queryClient: clientWithRetries(),
    });
    await expect(
      result.current.mutateAsync({
        account: VA,
        capability,
        withdrawal: { method: "withdraw", amount: 5n },
        deadline: 2_000_000_000n,
      }),
    ).rejects.toMatchObject({ cause: { hash: TEST_TX_HASH, approval: submitted.approval } });
    expect(early).toHaveBeenCalledOnce();
    expect(waitForTransactionReceipt).toHaveBeenCalledOnce();
  });
  it("does not repeat a schedule after receipt failure", async () => {
    const { config, readContract, writeContract, simulateContract, waitForTransactionReceipt } =
      createMockSymmioConfig();
    readContract.mockResolvedValue({ isExists: false });
    simulateContract.mockResolvedValue({ request: { functionName: "scheduleTimelockOp" } });
    writeContract.mockResolvedValue(TEST_TX_HASH);
    waitForTransactionReceipt.mockRejectedValue(new Error("timeout"));
    const { result } = renderHookWithProviders(() => useScheduleTimelockOp({ config }), {
      queryClient: clientWithRetries(),
    });
    await expect(
      result.current.mutateAsync({ account: ROOT, callData: "0x12345678", gasless: false }),
    ).rejects.toThrow();
    expect(writeContract).toHaveBeenCalledOnce();
    expect(waitForTransactionReceipt).toHaveBeenCalledOnce();
  });
  it("refreshes both root and virtual policy caches after confirmed setup", async () => {
    const { config } = createMockSymmioConfig();
    const queryClient = clientWithRetries();
    const rootKey = getTimelockPolicyQueryKey({ account: ROOT, configKey: config.getChainConfigKey() });
    const vaKey = getTimelockPolicyQueryKey({ account: VA, configKey: config.getChainConfigKey() });
    queryClient.setQueryData(rootKey, { ready: false });
    queryClient.setQueryData(vaKey, { ready: false });
    setup.mockResolvedValue({ hash: TEST_TX_HASH, receipt: { status: "success" }, indexing: "unknown" });
    const { result } = renderHookWithProviders(() => useSetupTimelockPolicy({ config }), { queryClient });
    await result.current.mutateAsync({ account: VA, capability });
    expect(queryClient.getQueryState(rootKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(vaKey)?.isInvalidated).toBe(true);
    expect(setup).toHaveBeenCalledOnce();
  });
  it("does not invalidate policy as confirmed when receipt waiting is disabled", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    early.mockResolvedValue(submitted);
    const queryClient = clientWithRetries();
    const key = getTimelockPolicyQueryKey({ account: VA, configKey: config.getChainConfigKey() });
    queryClient.setQueryData(key, { ready: true });
    const { result } = renderHookWithProviders(() => useEarlyWithdraw({ config, waitForReceipt: false }), {
      queryClient,
    });
    const value = await result.current.mutateAsync({
      account: VA,
      capability,
      withdrawal: { method: "withdraw", amount: 5n },
      deadline: 2_000_000_000n,
    });
    expect(value.hash).toBe(TEST_TX_HASH);
    expect(value.receipt).toBeUndefined();
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
