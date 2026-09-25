import { createConfig } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { maxUint256, type PublicClient } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useGaslessWalletCreationFee } from "./use-gasless-wallet-creation-fee";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
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

describe("useGaslessWalletCreationFee", () => {
  it("quotes the selected wallet on the connected chain", async () => {
    const { config, readContract } = buildConfig();
    readContract.mockResolvedValue(250_000n);

    const { result } = renderHookWithProviders(() =>
      useGaslessWalletCreationFee({ config, owner: OWNER, walletId: 2n }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(250_000n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: GASLESS_LAYER, functionName: "getWalletCreationFee", args: [OWNER, 2n] }),
    );
  });

  it("normalizes an invalid wallet id into an SDK SymmioRequestError without reading", async () => {
    const { config, readContract } = buildConfig();

    const { result } = renderHookWithProviders(() =>
      useGaslessWalletCreationFee({ config, owner: OWNER, walletId: maxUint256 + 1n }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sdk");
    expect(result.current.error?.code).toBe("GASLESS_WALLET_ID_INVALID");
    expect(readContract).not.toHaveBeenCalled();
  });
});
