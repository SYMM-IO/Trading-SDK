import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains/supported-chains";
import { createConfig } from "../core/config";
import { getSolverCapabilities, supportsGroupClose, supportsLimitOrder } from "./capabilities";

/** The shipped registry (no overrides). */
const config = createConfig({ getClient: () => ({}) as PublicClient, symmioConfig: {} });
const HYPER = SymmioSupportedChainId.HYPER_EVM;
const BASE = SymmioSupportedChainId.BASE;

describe("getSolverCapabilities / supportsGroupClose / supportsLimitOrder", () => {
  it("HyperEVM enigma: group close, no limit orders", () => {
    expect(getSolverCapabilities(config, { chainId: HYPER })).toEqual({ groupClose: true, limitOrder: false });
    expect(supportsGroupClose(config, { chainId: HYPER })).toBe(true);
    expect(supportsLimitOrder(config, { chainId: HYPER })).toBe(false);
  });

  it("Base rasa: limit orders, no group close", () => {
    expect(getSolverCapabilities(config, { chainId: BASE })).toEqual({ groupClose: false, limitOrder: true });
    expect(supportsGroupClose(config, { chainId: BASE })).toBe(false);
    expect(supportsLimitOrder(config, { chainId: BASE })).toBe(true);
  });

  it("returns all-false (never throws) for an unknown chain", () => {
    expect(getSolverCapabilities(config, { chainId: 1 })).toEqual({ groupClose: false, limitOrder: false });
    expect(supportsLimitOrder(config, { chainId: 1 })).toBe(false);
  });
});
