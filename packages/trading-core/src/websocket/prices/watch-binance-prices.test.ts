import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config } from "../../core/config";
import type { BinanceMarkPriceTick } from "../../price-service/types";
import { SymmError } from "../../shared/errors/symm-error";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import type { WebSocketConstructor } from "../../shared/types/websocket";
import type { SocketStatus } from "../socket/socket-status";
import { watchBinancePrices } from "./watch-binance-prices";

const CHAIN = SymmioSupportedChainId.BASE;
const WS_URL = "wss://fstream.binance.com/market/ws/!markPrice@arr@1s";

const BINANCE = { type: "binance" as const, url: "https://fapi.binance.com", wsUrl: WS_URL };
const ENIGMA = { type: "enigma" as const, url: "https://enigma.test", wsUrl: "wss://enigma.test/ws" };

function buildConfig(
  webSocketConstructor: WebSocketConstructor,
  priceService: typeof BINANCE | typeof ENIGMA = BINANCE,
): Config {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    webSocketConstructor,
    symmioConfig: {
      [CHAIN]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS }, priceService },
    },
  });
}

/** Captured verbatim from the live stream. */
const ENTRY = {
  e: "markPriceUpdate",
  E: 1785422506002,
  s: "BTCUSDT",
  p: "64790.20000000",
  i: "64818.28978261",
  r: "0.00010000",
  T: 1785427200000,
};

const ETH_ENTRY = { ...ENTRY, s: "ETHUSDT", p: "3200.5" };

describe("watchBinancePrices", () => {
  it("dials the configured wsUrl verbatim, with no subscribe frame", () => {
    const fake = createFakeWebSocket();
    const config = buildConfig(fake.WebSocket);

    const unwatch = watchBinancePrices(config, { chainId: CHAIN, onPrices: () => {} });
    fake.last().simulateOpen();

    expect(fake.last().url).toBe(WS_URL);
    expect(fake.last().sent).toEqual([]);
    unwatch();
  });

  it("delivers normalized ticks from a live-shaped frame", () => {
    const fake = createFakeWebSocket();
    const config = buildConfig(fake.WebSocket);
    const received: BinanceMarkPriceTick[][] = [];
    const statuses: SocketStatus[] = [];

    const unwatch = watchBinancePrices(config, {
      chainId: CHAIN,
      onPrices: (ticks) => received.push(ticks),
      onStatusChange: (s) => statuses.push(s),
    });

    fake.last().simulateOpen();
    expect(statuses).toContain("open");

    fake.last().simulateMessage([ENTRY, ETH_ENTRY]);

    expect(received[0]).toEqual([
      {
        provider: "binance",
        name: "BTCUSDT",
        markPrice: "64790.20000000",
        indexPrice: "64818.28978261",
        binanceLastFundingRate: "0.00010000",
        binanceNextFundingTime: 1785427200000,
        time: 1785422506002,
      },
      expect.objectContaining({ name: "ETHUSDT", markPrice: "3200.5" }),
    ]);
    unwatch();
  });

  it("applies the per-watcher name filter case-insensitively", () => {
    const fake = createFakeWebSocket();
    const config = buildConfig(fake.WebSocket);
    const received: BinanceMarkPriceTick[][] = [];

    watchBinancePrices(config, { chainId: CHAIN, names: ["btcusdt"], onPrices: (t) => received.push(t) });
    fake.last().simulateOpen();
    fake.last().simulateMessage([ENTRY, ETH_ENTRY]);

    expect(received[0]?.map((t) => t.name)).toEqual(["BTCUSDT"]);
  });

  /**
   * The filter must NOT be in the pool key: the pool fans one frame to every
   * listener, so filtering at the socket would starve siblings.
   */
  it("shares one socket between watchers with different filters", () => {
    const fake = createFakeWebSocket();
    const config = buildConfig(fake.WebSocket);
    const btc: BinanceMarkPriceTick[][] = [];
    const eth: BinanceMarkPriceTick[][] = [];

    const u1 = watchBinancePrices(config, { chainId: CHAIN, names: ["BTCUSDT"], onPrices: (t) => btc.push(t) });
    const u2 = watchBinancePrices(config, { chainId: CHAIN, names: ["ETHUSDT"], onPrices: (t) => eth.push(t) });

    expect(fake.instances.length).toBe(1);

    fake.last().simulateOpen();
    fake.last().simulateMessage([ENTRY, ETH_ENTRY]);

    expect(btc[0]?.map((t) => t.name)).toEqual(["BTCUSDT"]);
    expect(eth[0]?.map((t) => t.name)).toEqual(["ETHUSDT"]);
    u1();
    u2();
  });

  it("does not invoke onPrices when the filter matches nothing", () => {
    const fake = createFakeWebSocket();
    const config = buildConfig(fake.WebSocket);
    const received: BinanceMarkPriceTick[][] = [];

    watchBinancePrices(config, { chainId: CHAIN, names: ["NOPEUSDT"], onPrices: (t) => received.push(t) });
    fake.last().simulateOpen();
    fake.last().simulateMessage([ENTRY]);

    expect(received).toHaveLength(0);
  });

  it("ignores a control frame", () => {
    const fake = createFakeWebSocket();
    const config = buildConfig(fake.WebSocket);
    const received: BinanceMarkPriceTick[][] = [];

    watchBinancePrices(config, { chainId: CHAIN, onPrices: (t) => received.push(t) });
    fake.last().simulateOpen();
    fake.last().simulateMessage({ result: null, id: 1 });

    expect(received).toHaveLength(0);
  });

  it("refuses to run against a non-Binance price service", () => {
    const fake = createFakeWebSocket();
    const config = buildConfig(fake.WebSocket, ENIGMA);

    expect(() => watchBinancePrices(config, { chainId: CHAIN, onPrices: () => {} })).toThrow(SymmError);
    expect(() => watchBinancePrices(config, { chainId: CHAIN, onPrices: () => {} })).toThrow(
      /requires a "binance" price service/,
    );
  });

  it("uses a pool key distinct from the Enigma watcher's", () => {
    const fake = createFakeWebSocket();
    // Same host for both providers — only the key suffix keeps them apart, which
    // matters when an integrator proxies both through one origin.
    const shared = "wss://proxy.test/stream";
    const config = createConfig({
      getClient: () => ({}) as PublicClient,
      webSocketConstructor: fake.WebSocket,
      symmioConfig: {
        [CHAIN]: {
          addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
          priceService: { type: "binance", url: "https://fapi.test", wsUrl: shared },
        },
      },
    });

    const unwatch = watchBinancePrices(config, { chainId: CHAIN, onPrices: () => {} });
    expect(fake.last().url).toBe(shared);
    unwatch();
  });
});
