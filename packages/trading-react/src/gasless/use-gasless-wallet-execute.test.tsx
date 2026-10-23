import { createConfig, GaslessRequestStatus, SymmioSupportedChainId } from "@symmio/trading-core";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";

const gaslessWalletExecute = vi.hoisted(() => vi.fn());
const confirmGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    gaslessWalletExecuteMutationOptions: () => ({
      mutationKey: ["gaslessWalletExecute"] as const,
      mutationFn: gaslessWalletExecute,
    }),
    confirmGaslessRequest,
  };
});

import { useGaslessWalletExecute, type GaslessWalletExecuteVariables } from "./use-gasless-wallet-execute";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const TX_HASH = `0x${"cd".repeat(32)}` as const;

function buildConfig() {
  return createConfig({
    getClient: () => ({ waitForTransactionReceipt: vi.fn() }) as unknown as PublicClient,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
  });
}

describe("useGaslessWalletExecute", () => {
  beforeEach(() => {
    gaslessWalletExecute.mockReset();
    confirmGaslessRequest.mockReset();
    gaslessWalletExecute.mockResolvedValue({ requestId: "req-exit", status: GaslessRequestStatus.QUEUED });
    confirmGaslessRequest.mockImplementation(async () => ({
      request: { requestId: "req-exit", status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH },
      txHash: TX_HASH,
    }));
  });

  it("forwards every variable to the core action, including the idempotency key, filling only the chain", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useGaslessWalletExecute({ config }));
    const variables: GaslessWalletExecuteVariables = {
      signerAccount: SUB_ACCOUNT,
      walletId: 1n,
      calls: [{ target: USDC, data: "0xa9059cbb" }],
      operationType: "bridgeWithdraw",
      idempotencyKey: "exit-1",
    };

    await result.current.mutateAsync(variables);

    expect(gaslessWalletExecute).toHaveBeenCalledWith({ ...variables, chainId: CHAIN });
  });
});
