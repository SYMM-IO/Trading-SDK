import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains/supported-chains";
import { createConfig } from "../../core/config";

const fetchEnigmaMarkPrices = vi.hoisted(() => vi.fn());
const fetchBinanceMarkPrices = vi.hoisted(() => vi.fn());

vi.mock("../adapters/enigma-mark-prices", () => ({ fetchEnigmaMarkPrices }));
vi.mock("../adapters/binance-mark-prices", () => ({ fetchBinanceMarkPrices }));

import { getMarkPrices } from "./get-mark-prices";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const CHAIN = SymmioSupportedChainId.HYPER_EVM;

const ENIGMA_PRICE_SERVICE = {
  type: "enigma" as const,
  url: "https://enigma-price.test",
  wsUrl: "wss://enigma-price.test/ws",
};
const BINANCE_PRICE_SERVICE = {
  type: "binance" as const,
  url: "https://fapi.test",
  wsUrl: "wss://fstream.test/market/ws/x",
};

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [CHAIN]: {
      addresses: { affiliatesAddress: AFFILIATE },
      priceService: ENIGMA_PRICE_SERVICE,
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
          priceService: BINANCE_PRICE_SERVICE,
          notifications: { url: "wss://rasa.test/ws", protocol: "rasa" },
        },
      },
    },
  },
});

describe("getMarkPrices", () => {
  beforeEach(() => {
    fetchEnigmaMarkPrices.mockReset().mockResolvedValue([]);
    fetchBinanceMarkPrices.mockReset().mockResolvedValue([]);
  });

  it("dispatches to the chain-level provider for a solver with no override", async () => {
    await getMarkPrices(config, { chainId: CHAIN, solverId: "enigma", names: ["BTCUSDT"] });

    expect(fetchEnigmaMarkPrices).toHaveBeenCalledWith(ENIGMA_PRICE_SERVICE.url, ["BTCUSDT"]);
    expect(fetchBinanceMarkPrices).not.toHaveBeenCalled();
  });

  /** The whole point of the slice: a majors solver prices off Binance. */
  it("dispatches to the solver's own provider when it declares one", async () => {
    await getMarkPrices(config, { chainId: CHAIN, solverId: "rasa", names: ["BTCUSDT"] });

    expect(fetchBinanceMarkPrices).toHaveBeenCalledWith(BINANCE_PRICE_SERVICE.url, ["BTCUSDT"]);
    expect(fetchEnigmaMarkPrices).not.toHaveBeenCalled();
  });

  it("falls back to the chain's default solver when solverId is omitted", async () => {
    await getMarkPrices(config, { chainId: CHAIN });

    expect(fetchEnigmaMarkPrices).toHaveBeenCalledWith(ENIGMA_PRICE_SERVICE.url, undefined);
  });

  it("returns the adapter's ticks unchanged", async () => {
    const tick = { provider: "binance", name: "BTCUSDT", markPrice: "1", indexPrice: "2" };
    fetchBinanceMarkPrices.mockResolvedValue([tick]);

    expect(await getMarkPrices(config, { chainId: CHAIN, solverId: "rasa" })).toEqual([tick]);
  });

  it("wraps a transport failure as FETCH_MARK_PRICES_FAILED", async () => {
    fetchEnigmaMarkPrices.mockRejectedValue(new Error("boom"));

    await expect(getMarkPrices(config, { chainId: CHAIN })).rejects.toThrow(/Failed to fetch mark prices/);
  });
});
