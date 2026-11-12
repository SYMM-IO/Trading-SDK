import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains/supported-chains";
import { createConfig } from "../core/config";
import { getSolverCapabilities, supportsGroupClose, supportsLimitOrder } from "./capabilities";

/** The shipped registry (no overrides). */
const config = createConfig({ getClient: () => ({}) as PublicClient, symmioConfig: {} });
const HYPER = SymmioSupportedChainId.ARBITRUM;
const BASE = SymmioSupportedChainId.BASE;

describe("getSolverCapabilities / supportsGroupClose / supportsLimitOrder", () => {
  it("Arbitrum enigma: group close, no limit orders", () => {
    expect(getSolverCapabilities(config, { chainId: HYPER })).toEqual({
      groupClose: true,
      limitOrder: false,
      listingService: true,
      timelockApproval: false,
    });
    expect(supportsGroupClose(config, { chainId: HYPER })).toBe(true);
    expect(supportsLimitOrder(config, { chainId: HYPER })).toBe(false);
  });

  it("Base rasa: limit orders, no group close", () => {
    expect(getSolverCapabilities(config, { chainId: BASE })).toEqual({
      groupClose: false,
      limitOrder: true,
      listingService: false,
      timelockApproval: false,
    });
    expect(supportsGroupClose(config, { chainId: BASE })).toBe(false);
    expect(supportsLimitOrder(config, { chainId: BASE })).toBe(true);
  });

  it("returns all-false (never throws) for an unknown chain", () => {
    expect(getSolverCapabilities(config, { chainId: 1 })).toEqual({
      groupClose: false,
      limitOrder: false,
      listingService: false,
      timelockApproval: false,
    });
    expect(supportsLimitOrder(config, { chainId: 1 })).toBe(false);
  });

  it("resolves timelock support from each solver's deployment configuration", () => {
    const enabled = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [HYPER]: {
          addresses: { affiliatesAddress: "0x0000000000000000000000000000000000000001" },
          solvers: { enigma: { capabilities: { timelockApproval: true } } },
        },
      },
    });
    expect(getSolverCapabilities(enabled, { chainId: HYPER })).toMatchObject({
      timelockApproval: true,
      groupClose: true,
    });
    expect(getSolverCapabilities(enabled, { chainId: BASE })).toMatchObject({
      timelockApproval: false,
      limitOrder: true,
    });
  });
});
