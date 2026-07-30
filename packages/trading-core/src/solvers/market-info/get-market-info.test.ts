import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { GetGetMarketInfo200 } from "../types/generated/enigma-solver";

const getGetMarketInfo = vi.hoisted(() => vi.fn());
const getMarketInfoGetMarketInfoGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getGetMarketInfo,
  };
});

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, getMarketInfoGetMarketInfoGet };
});

import { getMarketInfo } from "./get-market-info";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const SAMPLE_RESPONSE: { data: GetGetMarketInfo200 } = {
  data: {
    BTCUSDT: { trading_volume: 12345.6, lifetime_value: 98765.4 },
    ETHUSDT: { trading_volume: "5000", lifetime_value: "40000" },
    total_value_24h: 17345.6,
    total_lifetime_value: 138765.4,
  },
};

describe("getMarketInfo", () => {
  beforeEach(() => {
    getGetMarketInfo.mockReset();
  });

  it("requests the config's solver base URL and splits totals from per-market rows", async () => {
    getGetMarketInfo.mockResolvedValue(SAMPLE_RESPONSE);

    const info = await getMarketInfo(config, {});

    expect(getGetMarketInfo).toHaveBeenCalledWith(expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(info).toEqual({
      kind: "enigma",
      markets: [
        { symbol: "BTCUSDT", tradingVolume: 12345.6, lifetimeValue: 98765.4 },
        { symbol: "ETHUSDT", tradingVolume: 5000, lifetimeValue: 40000 },
      ],
      totalValue24h: 17345.6,
      totalLifetimeValue: 138765.4,
    });
  });

  it("returns empty markets and zeroed totals when the solver reports nothing", async () => {
    getGetMarketInfo.mockResolvedValue({ data: {} });
    expect(await getMarketInfo(config, {})).toEqual({
      kind: "enigma",
      markets: [],
      totalValue24h: 0,
      totalLifetimeValue: 0,
    });
  });

  it("dispatches to the Rasa adapter on a Rasa chain (price / change / volume / cap rows)", async () => {
    getMarketInfoGetMarketInfoGet.mockResolvedValue({
      data: { BTCUSDT: { price: 65000, price_change_percent: 2.5, trade_volume: 5000, notional_cap: 1_000_000 } },
    });

    const info = await getMarketInfo(config, { chainId: SymmioSupportedChainId.BASE });

    expect(getMarketInfoGetMarketInfoGet).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: expect.any(String) }),
    );
    expect(info).toEqual({
      kind: "rasa",
      markets: [
        { symbol: "BTCUSDT", price: 65000, priceChangePercent: 2.5, tradeVolume: 5000, notionalCap: 1_000_000 },
      ],
    });
  });

  it("wraps request failures in a SymmError", async () => {
    getGetMarketInfo.mockRejectedValue(new Error("Network error"));
    await expect(getMarketInfo(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getMarketInfo(config, {})).rejects.toThrow("Failed to fetch market info");
  });
});
