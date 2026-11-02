import axios from "axios";
import { createPublicClient, http } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMarkPrices } from "../../price-service/get-mark-prices/get-mark-prices";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { watchEnigmaPrices } from "../../websocket/prices/watch-enigma-prices";
import { createConfig } from "../config";
import { getChainConfig } from "./actions/get-chain-config";
import { getEnigmaPriceServicePreset } from "./enigma-price-service-presets";

const environments = ["production", "staging"] as const;
const client = createPublicClient({ transport: http("https://rpc.invalid") });

afterEach(() => vi.restoreAllMocks());

describe("Enigma price-service presets", () => {
  it("preserves the production registry and separates staging endpoints", () => {
    const production = getEnigmaPriceServicePreset({ environment: "production" });
    const staging = getEnigmaPriceServicePreset({ environment: "staging" });
    expect(production).toEqual(getChainConfig(42161).priceService);
    expect(production).toEqual({
      type: "enigma",
      url: "https://lowcap-price.enigma.bz",
      wsUrl: "wss://lowcap-price.enigma.bz/ws",
    });
    expect(staging).toEqual({
      type: "enigma",
      url: "https://lowcap-price-staging.enigma.bz",
      wsUrl: "wss://lowcap-price.rasa.capital/ws",
    });
  });

  it.each(environments)("returns an independent %s configuration", (environment) => {
    const first = getEnigmaPriceServicePreset({ environment });
    const expected = { ...first };
    first.url = "https://custom.invalid";
    expect(getEnigmaPriceServicePreset({ environment })).toEqual(expected);
  });

  it.each(environments)("routes real SDK REST reads and shared streams through %s", async (environment) => {
    const priceService = getEnigmaPriceServicePreset({ environment });
    const fake = createFakeWebSocket();
    const config = createConfig({
      defaultChainId: 42161,
      getClient: () => client,
      webSocketConstructor: fake.WebSocket,
      symmioConfig: {
        42161: {
          addresses: { affiliatesAddress: "0x0000000000000000000000000000000000000000" },
          priceService,
          solvers: { enigma: { priceService } },
        },
      },
    });
    const transport = vi.fn(async (request) => ({
      data: { "TOKEN::1": { name: "TOKEN", markPrice: 0.00000012345, time: 12 } },
      status: 200,
      statusText: "OK",
      headers: {},
      config: request,
    }));
    const previousAdapter = axios.defaults.adapter;
    axios.defaults.adapter = transport;
    const received = vi.fn();
    const offA = watchEnigmaPrices(config, { chainId: 42161, solverId: "enigma", onPrices: received });
    const offB = watchEnigmaPrices(config, { chainId: 42161, solverId: "enigma", onPrices: vi.fn() });
    try {
      expect(await getMarkPrices(config, { chainId: 42161, solverId: "enigma", names: ["TOKEN::1"] })).toEqual([
        { provider: "enigma", name: "TOKEN::1", markPrice: "1.2345e-7", time: 12 },
      ]);
      expect(transport.mock.calls[0]?.[0]).toMatchObject({ baseURL: priceService.url, url: "/api/v1/prices/TOKEN::1" });
      expect(fake.instances).toHaveLength(1);
      expect(fake.last().url).toBe(priceService.wsUrl);
      fake.last().simulateOpen();
      fake.last().simulateMessage([{ name: "TOKEN::1", markPrice: 0.2, time: 13 }]);
      expect(received).toHaveBeenCalledWith([{ name: "TOKEN::1", markPrice: "0.2", time: 13 }]);
    } finally {
      offA();
      offB();
      axios.defaults.adapter = previousAdapter;
    }
    expect(fake.last().closeCalls).toHaveLength(1);
  });
});
