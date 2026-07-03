import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../supported-chains";
import { isChainSupported } from "./is-chain-supported";

describe("isChainSupported", () => {
  it("returns true for a chain with a built-in config", () => {
    expect(isChainSupported(SymmioSupportedChainId.HYPER_EVM)).toBe(true);
  });

  it("returns false for a chain without a built-in config", () => {
    expect(isChainSupported(mainnet.id)).toBe(false);
  });
});
