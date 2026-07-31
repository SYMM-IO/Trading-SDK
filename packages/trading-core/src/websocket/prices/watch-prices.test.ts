import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config } from "../../core/config";
import type { MarkPriceTick } from "../../price-service/types";
import { createFakeWebSocket } from "../../shared/test/fake-web-socket";
import { TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import type { WebSocketConstructor } from "../../shared/types/websocket";
import { watchPrices } from "./watch-prices";

const CHAIN = SymmioSupportedChainId.BASE;

const BINANCE = {
  type: "binance" as const,
  url: "https://fapi.binance.com",
  wsUrl: "wss://fstream.binance.com/market/ws/!markPrice@arr@1s",
};
const ENIGMA = { type: "enigma" as const, url: "https://enigma.test", wsUrl: "wss://enigma.test/ws" };

function buildConfig(ws: WebSocketConstructor, priceService: typeof BINANCE | typeof ENIGMA): Config {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    webSocketConstructor: ws,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS }, priceService } },
  });
}

describe("watchPrices", () => {
  it("routes to Binance and stamps the binance discriminant", () => {
    const fake = createFakeWebSocket();
    const received: MarkPriceTick[][] = [];

    watchPrices(buildConfig(fake.WebSocket, BINANCE), { chainId: CHAIN, onPrices: (t) => received.push(t) });
    fake.last().simulateOpen();
    fake.last().simulateMessage([{ s: "BTCUSDT", p: "64790.2", i: "1", r: "0", T: 2, E: 3 }]);

    expect(received[0]?.[0]).toMatchObject({ provider: "binance", name: "BTCUSDT", markPrice: "64790.2" });
  });

  /**
   * The Enigma tick type predates the union and has no discriminant, so the
   * facade stamps one. Without it a consumer could not narrow, and `provider`
   * would be `undefined` on half the union.
   */
  it("routes to Enigma and stamps the enigma discriminant", () => {
    const fake = createFakeWebSocket();
    const received: MarkPriceTick[][] = [];

    watchPrices(buildConfig(fake.WebSocket, ENIGMA), { chainId: CHAIN, onPrices: (t) => received.push(t) });
    fake.last().simulateOpen();
    fake.last().simulateMessage([{ name: "TIBBIR::A4..00_SFLOW", markPrice: 0.5 }]);

    expect(received[0]?.[0]).toEqual({ provider: "enigma", name: "TIBBIR::A4..00_SFLOW", markPrice: "0.5" });
  });

  it("lets the caller narrow on provider to reach provider-specific fields", () => {
    const fake = createFakeWebSocket();
    const indexPrices: string[] = [];

    watchPrices(buildConfig(fake.WebSocket, BINANCE), {
      chainId: CHAIN,
      onPrices: (ticks) => {
        for (const tick of ticks) if (tick.provider === "binance") indexPrices.push(tick.indexPrice);
      },
    });
    fake.last().simulateOpen();
    fake.last().simulateMessage([{ s: "BTCUSDT", p: "1", i: "64818.28978261", r: "0", T: 2 }]);

    expect(indexPrices).toEqual(["64818.28978261"]);
  });

  it("threads the name filter through to the provider watcher", () => {
    const fake = createFakeWebSocket();
    const received: MarkPriceTick[][] = [];

    watchPrices(buildConfig(fake.WebSocket, BINANCE), {
      chainId: CHAIN,
      names: ["BTCUSDT"],
      onPrices: (t) => received.push(t),
    });
    fake.last().simulateOpen();
    fake.last().simulateMessage([
      { s: "BTCUSDT", p: "1" },
      { s: "ETHUSDT", p: "2" },
    ]);

    expect(received[0]?.map((t) => t.name)).toEqual(["BTCUSDT"]);
  });
});
