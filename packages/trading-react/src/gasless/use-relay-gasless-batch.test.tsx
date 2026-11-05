import {
  createConfig,
  GaslessRequestStatus,
  getTimelockPolicyQueryKey,
  SymmioSupportedChainId,
  type Config,
  type ConfirmGaslessRequestParameters,
  type GaslessRequest,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";

const relayGaslessBatch = vi.hoisted(() => vi.fn());
const confirmGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    relayGaslessBatchMutationOptions: () => ({
      mutationKey: ["relayGaslessBatch"] as const,
      mutationFn: relayGaslessBatch,
    }),
    confirmGaslessRequest,
  };
});

import { useRelayGaslessBatch, type RelayGaslessBatchVariables } from "./use-relay-gasless-batch";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const SESSION_KEY = "0x5555555555555555555555555555555555555555" as const;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const TX_HASH = `0x${"cd".repeat(32)}` as const;

function buildConfig() {
  return createConfig({
    getClient: () => ({ waitForTransactionReceipt: vi.fn() }) as unknown as PublicClient,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
  });
}

const VARIABLES: RelayGaslessBatchVariables = {
  chainId: CHAIN,
  account: SUB_ACCOUNT,
  calls: [
    { functionName: "allocate", args: [5n] },
    { walletId: 2n, walletCalls: [{ target: USDC, data: "0xa9059cbb" }], from: SESSION_KEY },
  ],
};

describe("useRelayGaslessBatch", () => {
  beforeEach(() => {
    relayGaslessBatch.mockReset();
    confirmGaslessRequest.mockReset();
    relayGaslessBatch.mockResolvedValue({ requestId: "req-batch", status: GaslessRequestStatus.QUEUED });
    confirmGaslessRequest.mockImplementation(async () => ({
      request: { requestId: "req-batch", status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH },
      txHash: TX_HASH,
    }));
  });

  it("forwards every variable to the core action, filling only the chain", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useRelayGaslessBatch({ config }));
    const variables = {
      ...VARIABLES,
      chainId: undefined,
      from: SESSION_KEY,
      operationType: "onboarding",
      metadata: { source: "test" },
      idempotencyKey: "onboard-1",
      deadline: 2_000_000_300n,
    };

    await result.current.mutateAsync(variables);

    expect(relayGaslessBatch).toHaveBeenCalledWith({ ...variables, chainId: CHAIN });
  });

  it("resolves only after the relay is confirmed", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useRelayGaslessBatch({ config }));

    const resolved = await result.current.mutateAsync(VARIABLES);

    expect(resolved.accepted.requestId).toBe("req-batch");
    expect(resolved.confirmed?.txHash).toBe(TX_HASH);
  });

  it("reset() clears both the mutation and the relay progress without recursing", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useRelayGaslessBatch({ config }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });
    expect(result.current.isSuccess).toBe(true);

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.relay.phase).toBe("idle");
  });

  it("refreshes timelock policy only after observing successful execution", async () => {
    const config = buildConfig();
    const queryClient = new QueryClient();
    const key = getTimelockPolicyQueryKey({ account: SUB_ACCOUNT, configKey: config.getChainConfigKey(CHAIN) });
    queryClient.setQueryData(key, { ready: false });
    let finish = () => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let started = () => {};
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    confirmGaslessRequest.mockImplementation(async (_config: Config, parameters: ConfirmGaslessRequestParameters) => {
      started();
      await gate;
      const request: GaslessRequest = {
        service: "operations",
        requestId: "req-batch",
        status: GaslessRequestStatus.SUCCEEDED,
        txHash: TX_HASH,
        errorCode: null,
        errorMessage: null,
        idempotencyKey: "key-batch",
        owner: SUB_ACCOUNT,
        walletIds: [0n],
        createdAt: null,
        updatedAt: null,
        operationType: "setupTimelocks",
        accountId: null,
        feeAmountRaw: null,
      };
      parameters.onUpdate?.(request);
      return { request, txHash: TX_HASH };
    });
    const { result } = renderHookWithProviders(() => useRelayGaslessBatch({ config }), { queryClient });
    const pending = result.current.mutateAsync({
      ...VARIABLES,
      calls: [{ functionName: "setupTimelocks", args: [SUB_ACCOUNT, SESSION_KEY, 600n, ["0xb48c2317"]] }],
    });
    await waiting;
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    finish();
    await pending;
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("does not refresh policy when confirmation fails without observed success", async () => {
    const config = buildConfig();
    const queryClient = new QueryClient();
    const key = getTimelockPolicyQueryKey({ account: SUB_ACCOUNT, configKey: config.getChainConfigKey(CHAIN) });
    queryClient.setQueryData(key, { ready: false });
    confirmGaslessRequest.mockRejectedValue(new Error("Relay failed"));
    const { result } = renderHookWithProviders(() => useRelayGaslessBatch({ config }), { queryClient });
    await expect(
      result.current.mutateAsync({
        ...VARIABLES,
        calls: [{ functionName: "setupTimelocks", args: [SUB_ACCOUNT, SESSION_KEY, 600n, ["0xb48c2317"]] }],
      }),
    ).rejects.toThrow();
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
