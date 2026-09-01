import type { PublicClient } from "viem";
import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, listSupportedChains, SymmioSupportedChainId } from ".";
import { createConfig } from "../config/create-config";

function noopClient() {
  return {} as unknown as PublicClient;
}

describe("Arbitrum chain", () => {
  it("is a supported chain", () => {
    expect(SymmioSupportedChainId.ARBITRUM).toBe(42161);
    expect(listSupportedChains()).toContain(SymmioSupportedChainId.ARBITRUM);
  });

  it("ships its contract addresses and collateral configuration", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);

    expect(arbitrum.addresses).toEqual({
      symmioAddress: "0x573310dB6d160B26026B8706EBe9831c7dEF1D09",
      instantLayerAddress: "0xDBc6DAe3De0b10a10b6c4d1b33D4C79567E07F6d",
      accountLayerAddress: "0x5733107211B2801Acd39933a54d482FE303c4907",
      affiliatesAddress: "0xe99c18CF3C62B9229f9251fd2562077a33e7600a",
      collateralAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      collateralDecimals: 6,
    });
  });

  it("ships the Arbitrum analytics and events subgraphs", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);

    expect(arbitrum.subgraphs).toEqual({
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-events/latest/gn",
    });
  });

  it("registers the Arbitrum Enigma instance as the default solver", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);

    expect(Object.keys(arbitrum.solvers)).toEqual(["enigma"]);
    expect(arbitrum.defaultSolverId).toBe("enigma");
    expect(arbitrum.solvers.enigma).toMatchObject({
      name: "Enigma",
      address: "0x9be79D4977D86D440F9e1Ea0d468A58104B9b932",
      url: "https://arb-staging.enigma.bz/api",
      notifications: {
        url: "wss://notification.rasa.capital/ws/v1/subscribe",
        channel: "Arbitrum_Solver-Low-Cap_Stage",
        protocol: "enigma",
        searchUrl: "https://notification.rasa.capital/notification",
      },
    });
  });

  it("reuses the HyperEVM lowcap service and capability configuration", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);
    const hyperEvm = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

    expect(arbitrum.priceService).toEqual(hyperEvm.priceService);
    expect(arbitrum.muon).toEqual(hyperEvm.muon);
    expect(arbitrum.listing).toEqual(hyperEvm.listing);
    expect(arbitrum.inventory).toEqual(hyperEvm.inventory);
    expect(arbitrum.solvers.enigma?.tpsl).toEqual(hyperEvm.solvers.enigma?.tpsl);
    expect(arbitrum.solvers.enigma?.capabilities).toEqual(hyperEvm.solvers.enigma?.capabilities);
  });

  it("resolves the Arbitrum solver through Config", () => {
    const config = createConfig({
      symmioConfig: {
        [SymmioSupportedChainId.ARBITRUM]: { addresses: { affiliatesAddress: zeroAddress } },
      },
      getClient: noopClient,
    });

    expect(config.getSolver({ chainId: SymmioSupportedChainId.ARBITRUM })).toMatchObject({
      id: "enigma",
      address: "0x9be79D4977D86D440F9e1Ea0d468A58104B9b932",
      url: "https://arb-staging.enigma.bz/api",
    });
  });
});
