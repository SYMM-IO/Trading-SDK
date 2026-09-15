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

    const { result } = renderHookWithProviders(() =>
      useSupportsGaslessService({ config, chainId: SymmioSupportedChainId.BASE }),
    );

    expect(result.current).toBe(false);
  });

  it("reports false for Arbitrum with no override — the registry ships no gasless block", () => {
    const config = buildConfig(false);

    const { result } = renderHookWithProviders(() =>
      useSupportsGaslessService({ config, chainId: SymmioSupportedChainId.ARBITRUM }),
    );

    expect(result.current).toBe(false);
  });

  it("reports false on a 0.8.5 chain even if a gasless block is forced onto it", () => {
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.BASE]: {
          addresses: { affiliatesAddress: AFFILIATE },
          gasless: {
            url: "https://gaslessq.symmio.foundation",
            gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
          },
        },
      },
    });

    const { result } = renderHookWithProviders(() =>
      useSupportsGaslessService({ config, chainId: SymmioSupportedChainId.BASE }),
    );

    expect(result.current).toBe(false);
  });
});
