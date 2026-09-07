import { createConfig, GaslessRequestStatus, SymmioSupportedChainId } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";

const relayInstantOperations = vi.hoisted(() => vi.fn());
const confirmGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    relayInstantOperationsMutationOptions: () => ({
      mutationKey: ["relayInstantOperations"] as const,
      mutationFn: relayInstantOperations,
    }),
    confirmGaslessRequest,
  };
});

import { useRelayInstantOperations } from "./use-relay-instant-operations";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const SIGNER = "0xBabAD9AAA1a617886c272CEC2Ce7A132Fe2ECf29";
const TX_HASH = `0x${"cd".repeat(32)}` as const;

function buildConfig() {
  return createConfig({
    getClient: () => ({ waitForTransactionReceipt: vi.fn() }) as unknown as PublicClient,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
  });
}

const VARIABLES = {
  chainId: CHAIN,
  userAddress: SIGNER,
  operationType: "allocate",
  operations: [{ operation: { signerAccount: { addr: SIGNER, isPartyB: false } }, signature: "0x00" }],
} as unknown as Parameters<ReturnType<typeof useRelayInstantOperations>["mutateAsync"]>[0];

describe("useRelayInstantOperations", () => {
  beforeEach(() => {
    relayInstantOperations.mockReset();
    confirmGaslessRequest.mockReset();
    relayInstantOperations.mockResolvedValue({ requestId: "req-1", status: GaslessRequestStatus.QUEUED });
    confirmGaslessRequest.mockImplementation(async () => ({
      request: { requestId: "req-1", status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH },
      txHash: TX_HASH,
    }));
  });

  it("reset() clears both the mutation and the relay progress without recursing", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });
    expect(result.current.isSuccess).toBe(true);

    /**
     * The merged wrapper must call the observer's own `reset`, not the property
     * it just overwrote on the same object — that recursed until the stack blew.
     */
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.relay.phase).toBe("idle");
  });

  it("resolves only after the relay is confirmed", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }));

    const resolved = await result.current.mutateAsync(VARIABLES);

    expect(resolved.accepted.requestId).toBe("req-1");
    expect(resolved.confirmed?.txHash).toBe(TX_HASH);
  });
});
