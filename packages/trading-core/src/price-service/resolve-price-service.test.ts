import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains/supported-chains";
import { createConfig } from "../core/config";
import { resolvePriceService } from "./resolve-price-service";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const CHAIN = SymmioSupportedChainId.HYPER_EVM;

const CHAIN_LEVEL = { type: "enigma", url: "https://chain.test", wsUrl: "wss://chain.test/ws" } as const;
const SOLVER_LEVEL = { type: "binance", url: "https://solver.test", wsUrl: "wss://solver.test/ws" } as const;

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [CHAIN]: {
      addresses: { affiliatesAddress: AFFILIATE },
      priceService: CHAIN_LEVEL,
      defaultSolverId: "enigma",
      solvers: {
        enigma: {
          name: "Enigma",
          address: AFFILIATE,
          url: "https://enigma.test",
          notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
        },
        rasa: {
          name: "Rasa",
          address: AFFILIATE,
          url: "https://rasa.test",
          priceService: SOLVER_LEVEL,
          notifications: { url: "wss://rasa.test/ws", protocol: "rasa" },
        },
      },
    },
  },
});

describe("resolvePriceService", () => {
  it("falls back to the chain-level block when the solver declares none", () => {
    expect(resolvePriceService(config, { chainId: CHAIN, solverId: "enigma" })).toEqual(CHAIN_LEVEL);
  });

  it("prefers the solver's own block when it declares one", () => {
    expect(resolvePriceService(config, { chainId: CHAIN, solverId: "rasa" })).toEqual(SOLVER_LEVEL);
  });

  it("resolves through the chain's default solver when solverId is omitted", () => {
    expect(resolvePriceService(config, { chainId: CHAIN })).toEqual(CHAIN_LEVEL);
  });

  /**
   * Routing the existing Enigma price actions through this resolver must not add
   * a solver precondition they never had — a chain can serve prices with no
   * solver registered at all.
   */
  it("returns the chain block when the chain has no solver configured", () => {
    const solverless = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [CHAIN]: { addresses: { affiliatesAddress: AFFILIATE }, priceService: CHAIN_LEVEL, solvers: {} },
      },
    });

    expect(resolvePriceService(solverless, { chainId: CHAIN })).toEqual(CHAIN_LEVEL);
  });

  it("returns the chain block when the requested solver id is not configured", () => {
    expect(resolvePriceService(config, { chainId: CHAIN, solverId: "rasa" })).toEqual(SOLVER_LEVEL);

    const enigmaOnly = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [CHAIN]: {
          addresses: { affiliatesAddress: AFFILIATE },
          priceService: CHAIN_LEVEL,
          defaultSolverId: "enigma",
          solvers: {
            enigma: {
              name: "Enigma",
              address: AFFILIATE,
              url: "https://enigma.test",
              notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
            },
          },
        },
      },
    });

    expect(resolvePriceService(enigmaOnly, { chainId: CHAIN, solverId: "rasa" })).toEqual(CHAIN_LEVEL);
  });

  it("propagates an unsupported-chain error rather than swallowing it", () => {
    expect(() => resolvePriceService(config, { chainId: 1 })).toThrow(/Unsupported chain/i);
  });
});
