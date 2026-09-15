import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { CHAIN_CONFIGS } from "../registry";
import { SymmioSupportedChainId } from "../supported-chains";
import { getChainConfig } from "./get-chain-config";

const ARBITRUM = SymmioSupportedChainId.ARBITRUM;

describe("getChainConfig", () => {
  it("returns the registered config for a supported chain", () => {
    expect(getChainConfig(ARBITRUM)).toBe(CHAIN_CONFIGS[ARBITRUM]);
  });

  it("returns a config whose chainId matches the requested chain", () => {
    expect(getChainConfig(ARBITRUM).chainId).toBe(ARBITRUM);
  });

  it("throws a SymmError for an unsupported chain", () => {
    expect(() => getChainConfig(mainnet.id)).toThrow(SymmError);
  });
});
