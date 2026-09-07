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
      instantLayerAddress: "0x2C9e944cB71329fC659Da50A10a79a508Dd49ba5",
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
        url: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
        channel: "Arbitrum_Solver-Low-Cap_Stage",
        protocol: "enigma",
        searchUrl: "https://notification-stage.rasa.capital",
      },
    });
  });

  it("shares the HyperEVM Muon, listing, inventory and capability configuration", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);
    const hyperEvm = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

    expect(arbitrum.muon).toEqual(hyperEvm.muon);
    expect(arbitrum.solvers.enigma?.capabilities).toEqual(hyperEvm.solvers.enigma?.capabilities);
    /** TODO(vendor): inherited from HyperEVM and unconfirmed for Arbitrum. */
    expect(arbitrum.listing).toEqual(hyperEvm.listing);
    expect(arbitrum.inventory).toEqual(hyperEvm.inventory);
  });

  it("runs its own price service and conditional-order handler, not HyperEVM's", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);
    const hyperEvm = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

    /**
     * Both blocks were once a verbatim copy of HyperEVM's production values,
     * which pointed Arbitrum at a price feed missing half its markets and
     * signed its TP/SL orders against the wrong COH wallet.
     */
    expect(arbitrum.priceService).toEqual({
      type: "enigma",
      url: "https://lowcap-price-staging.enigma.bz",
      wsUrl: "wss://lowcap-price.rasa.capital/ws",
    });
    expect(arbitrum.solvers.enigma?.tpsl).toEqual({
      url: "https://tpsl-stage.enigma.bz",
      wsUrl: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
      appName: "ARB_COH_Low-Cap_Stage",
      cohWalletAddress: "0x5Cf3fC3722e1780220Ca94C04a6dc7Dfd7615661",
    });
    expect(arbitrum.priceService).not.toEqual(hyperEvm.priceService);
    expect(arbitrum.solvers.enigma?.tpsl).not.toEqual(hyperEvm.solvers.enigma?.tpsl);
  });

  it("ships the staging GaslessQ relayer block", () => {
    const arbitrum = getChainConfig(SymmioSupportedChainId.ARBITRUM);

    /**
     * The only chain in the registry with a gasless block. The GaslessLayer and
     * the InstantLayer above are one deployment's pair — the gateway reports
     * that InstantLayer from `instantLayer()`, and a mismatch is what
     * `assertGatewayCoherence` rejects.
     */
    expect(arbitrum.gasless).toEqual({
      url: "https://gaslessq-staging.symmio.foundation",
      protocolInstance: "arbitrum-42161-vibe-stage",
      gaslessLayerAddress: "0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca",
    });
    expect(arbitrum.gasless?.apiKey).toBeUndefined();
    /**
     * Pinned deliberately: the registry advertises the service but never turns
     * it on. Defaulting `mode` here would reroute every consumer's writes
     * through a staging relayer, so activation stays the integrator's call.
     */
    expect(arbitrum.gasless?.execution).toBeUndefined();
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
