import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../core/chains";
import { mockConfig } from "../shared/test/mock-config";
import { resolvePoolSource } from "./resolve-pool-source";

const HYPER_EVM_SYMMIO = getChainConfig(SymmioSupportedChainId.HYPER_EVM).addresses.symmioAddress;

describe("resolvePoolSource", () => {
  it("lower-cases the diamond so the subgraph's Bytes equality filter matches", () => {
    const { config } = mockConfig();

    /** Guards the test: a checksummed source would silently return zero rows. */
    expect(HYPER_EVM_SYMMIO).not.toBe(HYPER_EVM_SYMMIO.toLowerCase());
    expect(resolvePoolSource(config, SymmioSupportedChainId.HYPER_EVM)).toBe(HYPER_EVM_SYMMIO.toLowerCase());
  });

  it("falls back to the config's default chain when no chainId is passed", () => {
    const { config } = mockConfig();

    expect(resolvePoolSource(config)).toBe(HYPER_EVM_SYMMIO.toLowerCase());
  });

  it("resolves per chain rather than pinning one diamond", () => {
    const { config } = mockConfig();

    expect(resolvePoolSource(config, SymmioSupportedChainId.BASE)).toBe(
      getChainConfig(SymmioSupportedChainId.BASE).addresses.symmioAddress.toLowerCase(),
    );
  });
});
