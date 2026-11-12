import type { PublicClient } from "viem";
import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, listSupportedChains, SymmioSupportedChainId } from ".";
import { parseGaslessUrl } from "../../gasless/gasless-url";
import { buildGaslessHttpContext } from "../../gasless/http";
import { supportsGaslessService } from "../../gasless/resolve-gasless";
import { resolveGaslessStreamUrl } from "../../websocket/gasless/resolve-gasless-stream-url";
import { supportsGaslessStatusStream } from "../../websocket/gasless/watch-gasless-request";
import { createConfig } from "../config/create-config";

function noopClient() {
  return {} as unknown as PublicClient;
}

/** The built-in production gasless block; fails the test when the registry drops it. */
function productionGasless() {
  const { gasless } = getChainConfig(SymmioSupportedChainId.ARBITRUM);
  if (!gasless) throw new Error("Arbitrum ships no built-in gasless block");
  return gasless;
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
      instantLayerAddress: "0xf4e8b150fdc756aca578f5a05811c1998c65c829",
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
        searchUrl: "https://notification.rasa.capital",
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
    expect(arbitrum.muon.urls).toHaveLength(3);
    expect(arbitrum.listing).toEqual({ url: "https://listing85.enigma.bz" });
    expect(arbitrum.inventory).toEqual({ url: "https://inventory85.enigma.bz" });
    expect(arbitrum.solvers.enigma?.capabilities).toEqual({ groupClose: true, listingService: true });
  });

  it("ships the production GaslessQ deployment with execution left opt-in", () => {
    expect(getChainConfig(SymmioSupportedChainId.ARBITRUM).gasless).toEqual({
      url: "https://gaslessq.symmio.foundation",
      protocolInstance: "arbitrum-42161-vibe",
      gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
      statusStream: { enabled: true },
    });
  });

  it("resolves the production GaslessQ url as a gateway origin pinned to its instance", () => {
    const gasless = productionGasless();
    const chainId = SymmioSupportedChainId.ARBITRUM;
    const instanceRoot = `${gasless.url}/v1/instances/${gasless.protocolInstance}`;

    expect(parseGaslessUrl(chainId, gasless)).toEqual({
      form: "origin",
      url: gasless.url,
      protocolInstance: gasless.protocolInstance,
    });
    for (const service of ["operations", "deposits"] as const) {
      const context = buildGaslessHttpContext(chainId, gasless, service);
      expect(context.baseURL).toBe(`${instanceRoot}/${service}`);
      expect(context.requireInstanceHeader).toBe(true);
      /** Anonymous: the built-in block carries no partner key, so no `Authorization` header. */
      expect(context.headers).toEqual({ Accept: "application/json" });
      expect(resolveGaslessStreamUrl(chainId, gasless, service).url).toBe(
        `${instanceRoot.replace(/^https:/, "wss:")}/${service}/ws`,
      );
    }
  });

  it("supports gasless and its status stream on Arbitrum without a gasless override", () => {
    const chainId = SymmioSupportedChainId.ARBITRUM;
    const config = createConfig({
      symmioConfig: { [chainId]: { addresses: { affiliatesAddress: zeroAddress } } },
      getClient: noopClient,
    });

    expect(supportsGaslessService(config, { chainId })).toBe(true);
    expect(supportsGaslessStatusStream(config, { chainId, service: "operations" })).toBe(true);
    expect(supportsGaslessStatusStream(config, { chainId, service: "deposits" })).toBe(true);
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
