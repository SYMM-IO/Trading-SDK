import { createConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useSupportsGaslessService } from "./use-supports-gasless-service";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";

function buildConfig(withGasless: boolean) {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      [SymmioSupportedChainId.ARBITRUM]: {
        addresses: { affiliatesAddress: AFFILIATE },
        ...(withGasless
          ? {
              gasless: {
                url: "https://gaslessq.symmio.foundation",
                protocolInstance: "arbitrum-42161-vibe",
                gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
              },
            }
          : {}),
      },
    },
  });
}

describe("useSupportsGaslessService", () => {
  it("reports true for a chain carrying a gasless block on perps-core contracts", () => {
    const config = buildConfig(true);

    const { result } = renderHookWithProviders(() =>
      useSupportsGaslessService({ config, chainId: SymmioSupportedChainId.ARBITRUM }),
    );

    expect(result.current).toBe(true);
  });

  it("reports false for a chain with no gasless block, instead of throwing", () => {
    const config = buildConfig(false);

    /**
     * Base, not Arbitrum: Arbitrum ships a built-in gasless block, so an
     * override-free config is `true` there and the false branch is only
     * reachable through a chain that carries no block at all.
     */
    const { result } = renderHookWithProviders(() =>
      useSupportsGaslessService({ config, chainId: SymmioSupportedChainId.BASE }),
    );

    expect(result.current).toBe(false);
  });

  it("reports true for Arbitrum with no override — the registry ships its block", () => {
    const config = buildConfig(false);

    const { result } = renderHookWithProviders(() =>
      useSupportsGaslessService({ config, chainId: SymmioSupportedChainId.ARBITRUM }),
    );

    expect(result.current).toBe(true);
  });

  it("reports false on a 0.8.5 chain even if a gasless block is forced onto it", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: AFFILIATE },
          gasless: {
            url: "https://gaslessq.symmio.foundation",
            gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
          },
        },
      },
    });

    const { result } = renderHookWithProviders(() =>
      useSupportsGaslessService({ config, chainId: SymmioSupportedChainId.HYPER_EVM }),
    );

    expect(result.current).toBe(false);
  });
});
