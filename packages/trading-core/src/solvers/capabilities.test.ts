import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains/supported-chains";
import { createConfig } from "../core/config";
import { getSolverCapabilities, supportsGroupClose } from "./capabilities";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const BASE = SymmioSupportedChainId.BASE;

/** A chain with a capability-less rasa default and an explicit group-close-capable enigma. */
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [BASE]: {
      addresses: { affiliatesAddress: AFFILIATE },
      defaultSolverId: "rasa",
      solvers: {
        rasa: {
          name: "Rasa",
          address: AFFILIATE,
          url: "https://rasa.test",
          notifications: { url: "wss://rasa.test/ws", protocol: "rasa" },
        },
        enigma: {
          name: "Enigma",
          address: AFFILIATE,
          url: "https://enigma.test",
          tpsl: { url: "https://t", wsUrl: "wss://t", appName: "A", cohWalletAddress: AFFILIATE },
          notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "c" },
          capabilities: { groupClose: true },
        },
      },
    },
  },
});

describe("getSolverCapabilities / supportsGroupClose", () => {
  it("defaults an unflagged solver (rasa) to no group close and no tpsl", () => {
    expect(getSolverCapabilities(config, { chainId: BASE })).toEqual({ tpsl: false, groupClose: false });
    expect(supportsGroupClose(config, { chainId: BASE })).toBe(false);
  });

  it("reads groupClose + tpsl from the solver config (enigma)", () => {
    expect(getSolverCapabilities(config, { chainId: BASE, solverId: "enigma" })).toEqual({
      tpsl: true,
      groupClose: true,
    });
    expect(supportsGroupClose(config, { chainId: BASE, solverId: "enigma" })).toBe(true);
  });

  it("returns all-false (never throws) for an unknown chain", () => {
    expect(getSolverCapabilities(config, { chainId: 1 })).toEqual({ tpsl: false, groupClose: false });
    expect(supportsGroupClose(config, { chainId: 1 })).toBe(false);
  });

  it("has group close enabled on the built-in enigma (HyperEVM) registry entry", () => {
    const registryConfig = createConfig({ getClient: () => ({}) as PublicClient, symmioConfig: {} });
    expect(supportsGroupClose(registryConfig, { chainId: SymmioSupportedChainId.HYPER_EVM })).toBe(true);
  });
});
