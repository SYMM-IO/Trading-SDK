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
      symmioAddress: "0x57331027091994FCb9c5Aec48ea92cEf0a93CF6A",
      instantLayerAddress: "0xCB8F789d6f7e59B3D266490e1Aa8e35cFb755132",
      accountLayerAddress: "0x573310d1D6ec18cB21E1aB949414470D9bf5c24E",
      affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D",
      collateralAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      collateralDecimals: 6,
    });
  });

  it("ships the Arbitrum analytics and events subgraphs", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);

    expect(arbitrum.subgraphs).toEqual({
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-mainnet-analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-mainnet-events/stage/gn",
    });
  });

  it("registers the Arbitrum Enigma instance as the default solver", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);

    expect(Object.keys(arbitrum.solvers)).toEqual(["enigma"]);
    expect(arbitrum.defaultSolverId).toBe("enigma");
    expect(arbitrum.solvers.enigma).toMatchObject({
      name: "Enigma",
      address: "0x0420b24359d2DCccA53904042aa36A641162445c",
      url: "https://solver.enigma.bz/api",
      tpsl: {
        url: "https://tpsl.enigma.bz",
        appName: "Arbitrum_COH_Production",
        cohWalletAddress: "0xFC3a98d30AdAA220Ae4150fcaC06Bd200b6E146B",
      },
      notifications: {
        url: "wss://notification.rasa.capital/ws/v1/subscribe",
        channel: "Arbitrum_Solver-Low-Cap_Production",
        protocol: "enigma",
        searchUrl: "https://notification.rasa.capital/notification",
      },
    });
  });

  it("ships the lowcap services and capabilities", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);

    expect(arbitrum.priceService).toEqual({
      type: "enigma",
      url: "https://lowcap-price.enigma.bz",
      wsUrl: "wss://lowcap-price.enigma.bz/ws",
    });
    expect(arbitrum.muon.urls).toHaveLength(4);
    expect(arbitrum.listing).toEqual({ url: "https://listing85.enigma.bz" });
    expect(arbitrum.inventory).toEqual({ url: "https://inventory85.enigma.bz" });
    expect(arbitrum.solvers.enigma?.capabilities).toEqual({ groupClose: true, listingService: true });
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
      address: "0x0420b24359d2DCccA53904042aa36A641162445c",
      url: "https://solver.enigma.bz/api",
    });
  });
});
