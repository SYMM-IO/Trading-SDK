import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { supportsEstimatedPrice } from "./supports-estimated-price";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("supportsEstimatedPrice", () => {
  it("supports the enigma solver", () => {
    expect(supportsEstimatedPrice(config, { chainId: SymmioSupportedChainId.HYPER_EVM })).toBe(true);
  });

  it("does not support the rasa solver (its API has no /estimated-price route)", () => {
    expect(supportsEstimatedPrice(config, { chainId: SymmioSupportedChainId.BASE })).toBe(false);
  });

  it("returns false instead of throwing for an unknown chain", () => {
    expect(supportsEstimatedPrice(config, { chainId: 1 })).toBe(false);
  });
});
