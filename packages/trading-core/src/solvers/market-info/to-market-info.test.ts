import { describe, expect, it } from "vitest";
import type { GetGetMarketInfo200 } from "../types/generated/enigma-solver";
import { toMarketInfo } from "./to-market-info";

describe("toMarketInfo", () => {
  it("splits aggregate totals from per-market rows and coerces string numbers", () => {
    const raw: GetGetMarketInfo200 = {
      BTCUSDT: { trading_volume: 12345.6, lifetime_value: 98765.4 },
      ETHUSDT: { trading_volume: "5000", lifetime_value: "40000" },
      total_value_24h: 17345.6,
      total_lifetime_value: 138765.4,
    };

    expect(toMarketInfo(raw)).toEqual({
      markets: [
        { symbol: "BTCUSDT", tradingVolume: 12345.6, lifetimeValue: 98765.4 },
        { symbol: "ETHUSDT", tradingVolume: 5000, lifetimeValue: 40000 },
      ],
      totalValue24h: 17345.6,
      totalLifetimeValue: 138765.4,
    });
  });

  it("defaults missing or non-finite numeric fields to 0", () => {
    const raw: GetGetMarketInfo200 = {
      BTCUSDT: { trading_volume: "not-a-number" },
    };

    expect(toMarketInfo(raw)).toEqual({
      markets: [{ symbol: "BTCUSDT", tradingVolume: 0, lifetimeValue: 0 }],
      totalValue24h: 0,
      totalLifetimeValue: 0,
    });
  });

  it("returns empty markets and zeroed totals for an empty bag", () => {
    expect(toMarketInfo({})).toEqual({ markets: [], totalValue24h: 0, totalLifetimeValue: 0 });
  });

  it("skips non-object entries that are not aggregate keys", () => {
    const raw: GetGetMarketInfo200 = {
      BTCUSDT: { trading_volume: 100, lifetime_value: 200 },
      /** A stray scalar that is not a known aggregate key must not become a market. */
      some_scalar: 999,
      total_value_24h: 100,
      total_lifetime_value: 200,
    };

    const result = toMarketInfo(raw);
    expect(result.markets).toEqual([{ symbol: "BTCUSDT", tradingVolume: 100, lifetimeValue: 200 }]);
    expect(result.totalValue24h).toBe(100);
    expect(result.totalLifetimeValue).toBe(200);
  });
});
