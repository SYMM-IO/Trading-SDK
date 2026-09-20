import { createConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { PublicClient } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useGaslessWalletNonce } from "./use-gasless-wallet-nonce";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
/** A synthetic GaslessLayer address — reads go to the stub client, never to a chain. */
const GASLESS_LAYER = "0x000000000000000000000000000000000000ea51" as const;

function buildConfig() {
  const readContract = vi.fn();
  const config = createConfig({
    getClient: () => ({ readContract }) as unknown as PublicClient,
    symmioConfig: {
      [arbitrum.id]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        gasless: {
          url: "https://gaslessq-staging.symmio.foundation",
          protocolInstance: "arbitrum-42161-test",
          gaslessLayerAddress: GASLESS_LAYER,
        },
      },
    },
  });
  return { config, readContract };
}

describe("useGaslessWalletNonce", () => {
  it("reads the (owner, walletId, account) stream on the connected chain", async () => {
    const { config, readContract } = buildConfig();
    readContract.mockResolvedValue(7n);

    const { result } = renderHookWithProviders(() =>
      useGaslessWalletNonce({ config, owner: OWNER, walletId: 1n, account: SUB_ACCOUNT }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: GASLESS_LAYER,
        functionName: "walletOperationNonces",
        args: [OWNER, 1n, SUB_ACCOUNT],
      }),
    );
  });

  it("normalizes a chain without a gasless block into an SDK SymmioRequestError", async () => {
    const { config, readContract } = buildConfig();

    const { result } = renderHookWithProviders(() =>
      useGaslessWalletNonce({ config, chainId: SymmioSupportedChainId.BASE, owner: OWNER, account: OWNER }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sdk");
    expect(result.current.error?.code).toBe("GASLESS_NOT_CONFIGURED");
    expect(readContract).not.toHaveBeenCalled();
  });
});
