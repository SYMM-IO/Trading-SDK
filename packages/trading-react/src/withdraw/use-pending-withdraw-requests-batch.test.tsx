import { createClassicWithdrawPart, getPendingWithdrawRequestsBatchQueryKey } from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useInitiateWithdraw } from "./use-initiate-withdraw";
import { usePendingWithdrawRequestsBatch } from "./use-pending-withdraw-requests-batch";
const USER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
describe("usePendingWithdrawRequestsBatch", () => {
  it("keeps an empty scope disabled", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => usePendingWithdrawRequestsBatch({ config, users: [] }));
    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });
  it("reads every sparse page through the real core action", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockImplementation(async ({ functionName, args }) =>
      functionName === "getLastWithdrawRequestId" ? 401n : args[1] === 401n ? [{ id: 401n }] : [],
    );
    const { result } = renderHookWithProviders(() =>
      usePendingWithdrawRequestsBatch({ config, users: [USER], chainId: arbitrum.id }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ user: USER, requests: [{ id: 401n }] }]);
    expect(readContract).toHaveBeenCalledTimes(4);
  });
  it("normalizes failures without exposing partial requests", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValue(new Error("RPC unavailable"));
    const { result } = renderHookWithProviders(() =>
      usePendingWithdrawRequestsBatch({ config, users: [USER], query: { retry: false } }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ name: "SymmioRequestError", message: "RPC unavailable" });
    expect(result.current.data).toBeUndefined();
  });
});

describe("batch invalidation", () => {
  it("refreshes every page size in the deployment after the receipt, keeping other deployments intact", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    const hash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    writeContract.mockResolvedValue(hash);
    let confirm!: (receipt: unknown) => void;
    waitForTransactionReceipt.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = config.getChainConfigKey(arbitrum.id);
    const ownKeys = [2n, 200n].map((pageSize) =>
      getPendingWithdrawRequestsBatchQueryKey({ users: [USER], pageSize, chainId: arbitrum.id, configKey: scope }),
    );
    const other = getPendingWithdrawRequestsBatchQueryKey({ users: [USER], configKey: "other-deployment" });
    for (const key of [...ownKeys, other]) client.setQueryData(key, []);
    const { result } = renderHookWithProviders(() => useInitiateWithdraw({ config }), { queryClient: client });
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.mutateAsync({
        account: USER,
        chainId: arbitrum.id,
        parts: [createClassicWithdrawPart({ id: 0n, amount: 1n, receiver: USER, chainId: BigInt(arbitrum.id) })],
      });
    });
    await waitFor(() => expect(waitForTransactionReceipt).toHaveBeenCalledTimes(1));
    for (const key of ownKeys) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    await act(async () => {
      confirm({ status: "success", transactionHash: hash });
      await pending;
    });
    for (const key of ownKeys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  });

  it("leaves batch confirmation and refresh to broadcast-only callers", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValue("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = getPendingWithdrawRequestsBatchQueryKey({
      users: [USER],
      chainId: arbitrum.id,
      configKey: config.getChainConfigKey(arbitrum.id),
    });
    client.setQueryData(key, []);
    const { result } = renderHookWithProviders(() => useInitiateWithdraw({ config, waitForReceipt: false }), {
      queryClient: client,
    });
    await act(async () => {
      await result.current.mutateAsync({
        account: USER,
        chainId: arbitrum.id,
        parts: [createClassicWithdrawPart({ id: 0n, amount: 1n, receiver: USER, chainId: BigInt(arbitrum.id) })],
      });
    });
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
