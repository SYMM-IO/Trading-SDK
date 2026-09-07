import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { createConfig } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import { resolveGaslessService, supportsGaslessService } from "./resolve-gasless";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const GASLESS = {
  url: "https://gaslessq.symmio.foundation",
  protocolInstance: "arbitrum-42161-vibe",
  gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
} as const;

function buildConfig(overrides?: Record<number, Record<string, unknown>>) {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      [SymmioSupportedChainId.ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE } },
      ...overrides,
    },
  });
}

describe("resolveGaslessService", () => {
  it("throws GASLESS_NOT_CONFIGURED when the chain has no gasless block", () => {
    const config = buildConfig();

    /**
     * Base, not Arbitrum: Arbitrum ships a built-in block, so the not-configured
     * branch is only reachable through a chain that has none. The block check
     * runs before the contracts-version gate, so a 0.8.5 chain lands here too.
     */
    expect(() => resolveGaslessService(config, { chainId: SymmioSupportedChainId.BASE })).toThrowError(SymmError);
    try {
      resolveGaslessService(config, { chainId: SymmioSupportedChainId.BASE });
    } catch (err) {
      expect((err as SymmError).code).toBe("GASLESS_NOT_CONFIGURED");
    }
  });

  it("returns Arbitrum's built-in staging block with no override at all", () => {
    const config = buildConfig();

    const resolved = resolveGaslessService(config, { chainId: SymmioSupportedChainId.ARBITRUM });
    expect(resolved.url).toBe("https://gaslessq-staging.symmio.foundation");
    expect(resolved.protocolInstance).toBe("arbitrum-42161-vibe-stage");
    expect(resolved.gaslessLayerAddress).toBe("0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca");
  });

  it("returns the chain's gasless block on a perps-core chain", () => {
    const config = buildConfig({
      [SymmioSupportedChainId.ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE }, gasless: { ...GASLESS } },
    });

    const resolved = resolveGaslessService(config, { chainId: SymmioSupportedChainId.ARBITRUM });
    expect(resolved.url).toBe(GASLESS.url);
    expect(resolved.gaslessLayerAddress).toBe(GASLESS.gaslessLayerAddress);
  });

  it("throws GASLESS_UNSUPPORTED_CONTRACTS_VERSION on a 0.8.5 chain even with a gasless block", () => {
    const config = buildConfig({
      [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: AFFILIATE }, gasless: { ...GASLESS } },
    });

    try {
      resolveGaslessService(config, { chainId: SymmioSupportedChainId.HYPER_EVM });
      expect.unreachable("expected resolveGaslessService to throw");
    } catch (err) {
      expect((err as SymmError).code).toBe("GASLESS_UNSUPPORTED_CONTRACTS_VERSION");
    }
  });
});

describe("supportsGaslessService", () => {
  it("is false without a gasless block, true with one", () => {
    const bare = buildConfig();
    expect(supportsGaslessService(bare, { chainId: SymmioSupportedChainId.BASE })).toBe(false);

    /** Arbitrum needs no override — the registry ships its block. */
    expect(supportsGaslessService(bare, { chainId: SymmioSupportedChainId.ARBITRUM })).toBe(true);

    const configured = buildConfig({
      [SymmioSupportedChainId.ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE }, gasless: { ...GASLESS } },
    });
    expect(supportsGaslessService(configured, { chainId: SymmioSupportedChainId.ARBITRUM })).toBe(true);
  });

  it("is false for a chain the config does not know", () => {
    const config = buildConfig();
    expect(supportsGaslessService(config, { chainId: 1 })).toBe(false);
  });
});
