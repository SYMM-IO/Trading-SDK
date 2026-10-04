import { createConfig, GaslessRequestStatus, SymmioSupportedChainId } from "@symmio/trading-core";
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
    { walletId: 2n, walletCalls: [{ target: USDC, data: "0xa9059cbb" }] },
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
});
