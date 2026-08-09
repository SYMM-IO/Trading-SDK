import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains/supported-chains";
import { createConfig } from "../../core/config";

const fetchEnigmaMarkPrices = vi.hoisted(() => vi.fn());
const fetchBinanceMarkPrices = vi.hoisted(() => vi.fn());

vi.mock("../adapters/enigma-mark-prices", () => ({ fetchEnigmaMarkPrices }));
vi.mock("../adapters/binance-mark-prices", () => ({ fetchBinanceMarkPrices }));

import * as actionModule from "./get-mark-prices";
import { getMarkPricesQueryKey, getMarkPricesQueryOptions } from "./query";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const CHAIN = SymmioSupportedChainId.HYPER_EVM;

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [CHAIN]: {
      addresses: { affiliatesAddress: AFFILIATE },
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
          notifications: { url: "wss://rasa.test/ws", protocol: "rasa" },
        },
      },
    },
  },
});

describe("getMarkPricesQueryOptions", () => {
  beforeEach(() => {
    fetchEnigmaMarkPrices.mockReset().mockResolvedValue([]);
    fetchBinanceMarkPrices.mockReset().mockResolvedValue([]);
  });

  /**
   * ARCHITECTURE §3.5. The cache key picks up new parameters automatically
   * (`filterQueryOptions` is a blacklist) but `queryFn` enumerates them by hand.
   * A forgotten field gives every variant its own cache entry — all populated
   * from the default's data, with no error and no type error.
   *
   * Asserted with an EXACT object literal, not `objectContaining`, so adding a
   * parameter without forwarding it fails this test.
   */
  it("forwards every action parameter to the action", async () => {
    const spy = vi.spyOn(actionModule, "getMarkPrices").mockResolvedValue([]);

    const options = getMarkPricesQueryOptions(config, {
      chainId: CHAIN,
      solverId: "rasa",
      names: ["BTCUSDT"],
      query: { staleTime: 1234 },
    });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith(config, { chainId: CHAIN, solverId: "rasa", names: ["BTCUSDT"] });
    spy.mockRestore();
  });

  it("varies the key by each identifying parameter", () => {
    const key = (options: NonNullable<Parameters<typeof getMarkPricesQueryKey>[0]>) =>
      JSON.stringify(getMarkPricesQueryKey({ ...options, configKey: "x" }));

    expect(key({ names: ["BTCUSDT"] })).not.toBe(key({ names: ["ETHUSDT"] }));
    expect(key({ solverId: "rasa" })).not.toBe(key({ solverId: "enigma" }));
    expect(key({ chainId: CHAIN })).not.toBe(key({ chainId: SymmioSupportedChainId.BASE }));
  });

  it("does not vary the key by TanStack control options", () => {
    const a = getMarkPricesQueryKey({ names: ["BTCUSDT"], configKey: "x" });
    const b = getMarkPricesQueryKey({ names: ["BTCUSDT"], configKey: "x" });

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("folds the chain config key so a config override rotates the cache", () => {
    const [, filtered] = getMarkPricesQueryOptions(config, { chainId: CHAIN }).queryKey;

    expect((filtered as { configKey?: string }).configKey).toBe(config.getChainConfigKey(CHAIN));
  });

  it("is enabled by default and respects an explicit override", () => {
    expect(getMarkPricesQueryOptions(config, {}).enabled).toBe(true);
    expect(getMarkPricesQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });
});
