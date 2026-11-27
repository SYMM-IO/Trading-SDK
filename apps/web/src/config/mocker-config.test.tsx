import { createConfig } from "@symmio/trading-core";
import { act, renderHook } from "@testing-library/react";
import { arbitrum } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMockerConfig } from "./mocker-config";

const chainId = arbitrum.id;
const address = "0x1234567890123456789012345678901234567890";
const panel = "http://localhost:7829";
const rpcUrl = `${panel}/rpc`;
const mockConfigResponse = {
  chainId,
  rpcUrl,
  symmioConfig: {
    [chainId]: {
      addresses: {
        symmioAddress: address,
        instantLayerAddress: address,
        accountLayerAddress: address,
        collateralAddress: address,
        affiliatesAddress: address,
      },
      solvers: {
        enigma: {
          address,
          url: `${panel}/solver`,
          notifications: {
            protocol: "enigma",
            url: "ws://localhost:7829/updates",
            searchUrl: `${panel}/notifications`,
            channel: "test-solver",
          },
          tpsl: {
            url: `${panel}/tpsl`,
            wsUrl: "ws://localhost:7829/updates",
            appName: "test-conditional-orders",
            cohWalletAddress: address,
          },
        },
      },
      priceService: { type: "enigma", url: `${panel}/prices`, wsUrl: "ws://localhost:7829/prices" },
      muon: { urls: [`${panel}/muon`] },
      subgraphs: { analytics: `${panel}/analytics`, events: `${panel}/events` },
      listing: { url: `${panel}/listing` },
      inventory: { url: `${panel}/inventory` },
      gasless: {
        url: `${panel}/gasless`,
        protocolInstance: "test",
        gaslessLayerAddress: address,
        statusStream: { enabled: true },
      },
    },
  },
};

function selectEnvironment(config: unknown, rpcOverride = "") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_MOCKER_CONFIG", config ? JSON.stringify(config) : "");
  vi.stubEnv("NEXT_PUBLIC_ARBITRUM_RPC_URL", rpcOverride);
}

describe("MOCKER deployment config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("uses the published RPC and resolves every Arbitrum service to MOCKER", async () => {
    selectEnvironment(mockConfigResponse, "https://other-rpc.example");
    const { symmioChains } = await import("./symmio");
    const { wagmiConfig } = await import("./wagmi");
    const sdk = createConfig({
      symmioConfig: symmioChains,
      getClient() {
        throw new Error("Config inspection uses no RPC client.");
      },
    });
    const resolved = sdk.getChainConfig(chainId);
    const urls = JSON.stringify(resolved).match(/(?:https?|wss?):[^"\s]+/g) ?? [];

    expect(resolved.addresses).toMatchObject(mockConfigResponse.symmioConfig[chainId].addresses);
    expect(resolved.solvers.enigma?.tpsl).toEqual(mockConfigResponse.symmioConfig[chainId].solvers.enigma.tpsl);
    expect(urls.length).toBeGreaterThan(10);
    expect(urls.every((url) => new URL(url).host === new URL(panel).host)).toBe(true);
    expect(wagmiConfig.chains.find((chain) => chain.id === chainId)?.rpcUrls.default.http).toEqual([rpcUrl]);
  });

  it("rejects incomplete responses and services on another host", () => {
    const config = structuredClone(mockConfigResponse);
    config.symmioConfig[chainId].solvers.enigma.tpsl.url = "https://conditional-orders.example";
    expect(() => parseMockerConfig(config, panel)).toThrow(/local TP\/SL handler/);
    expect(() => parseMockerConfig({ chainId, rpcUrl }, panel)).toThrow(/Arbitrum RPC and SDK configuration/);
  });

  it("preserves the live RPC override and viem default outside MOCKER", async () => {
    selectEnvironment(undefined, "https://other-rpc.example");
    const { wagmiConfig } = await import("./wagmi");
    expect(wagmiConfig.chains[0].rpcUrls.default.http).toEqual(["https://other-rpc.example"]);
    selectEnvironment(undefined);
    const { wagmiConfig: liveConfig } = await import("./wagmi");
    expect(liveConfig.chains[0].rpcUrls.default.http).toEqual(arbitrum.rpcUrls.default.http);
  });

  it("applies only the saved gasless preference to the current mock deployment", async () => {
    selectEnvironment(mockConfigResponse);
    const key = `symmio.config.overrides.v4.mocker.${rpcUrl}`;
    const oldOverrides = { [chainId]: { addresses: { instantLayerAddress: "0xff" } } };
    localStorage.setItem("symmio.config.overrides.v4", JSON.stringify(oldOverrides));
    const { SymmioOverridesProvider, useSymmioOverrides } = await import("@/features/config/symmio-overrides-store");
    const { result } = renderHook(useSymmioOverrides, { wrapper: SymmioOverridesProvider });
    expect(result.current.overrides?.[chainId]?.addresses?.instantLayerAddress).toBe(address);

    act(() => {
      result.current.setOverrides({
        [chainId]: {
          addresses: { affiliatesAddress: address, instantLayerAddress: "0xff" },
          gasless: { url: "https://other-relay.example", execution: { mode: "gasless" } },
        },
      });
    });
    expect(result.current.overrides?.[chainId]?.gasless).toMatchObject({
      url: `${panel}/gasless`,
      execution: { mode: "gasless" },
    });
    expect(result.current.overrides?.[chainId]?.addresses?.instantLayerAddress).toBe(address);
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual({
      [chainId]: { gasless: { execution: { mode: "gasless" } } },
    });
    expect(JSON.parse(localStorage.getItem("symmio.config.overrides.v4") ?? "null")).toEqual(oldOverrides);
  });
});
