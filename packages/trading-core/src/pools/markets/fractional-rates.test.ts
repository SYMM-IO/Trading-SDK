import { describe, expect, it } from "vitest";
import { toListingMarketDetail } from "../market-detail/to-listing-market-detail";
import { toUserPoolProfit } from "../profit/to-user-pool-profit";
import { toListingMarket } from "./to-listing-market";
describe("fractional percentage contracts", () => {
  it.each([
    ["12.75", 12750000000000000000n],
    ["0.5", 500000000000000000n],
  ])("preserves %s in every catalog, detail and profit rate", (wire, scaled) => {
    const raw = Object.fromEntries(
      [
        "apr",
        "apy_24h",
        "apy_30d",
        "apy_lifetime",
        ...["1h", "6h", "24h", "30d", "lifetime"].flatMap((window) =>
          ["apr", "apy", "tvl_driven_apy", "price_driven_apy"].map((prefix) => prefix + "_" + window),
        ),
      ].map((field) => [field, wire]),
    );
    const catalog = toListingMarket(raw as unknown as Parameters<typeof toListingMarket>[0]);
    expect(catalog.apr).toBe(scaled);
    expect(catalog.apy24h).toBe(scaled);
    expect(catalog.apy30d).toBe(scaled);
    expect(catalog.apyLifetime).toBe(scaled);
    for (const rate of [
      ...Object.values(catalog.aprByWindow),
      ...Object.values(catalog.tvlDrivenApy),
      ...Object.values(catalog.priceDrivenApy),
    ])
      expect(rate).toBe(scaled);
    const detail = toListingMarketDetail(raw as unknown as Parameters<typeof toListingMarketDetail>[0]);
    for (const rate of Object.values(detail.apy)) expect(rate).toBe(scaled);
    const profit = toUserPoolProfit(raw as unknown as Parameters<typeof toUserPoolProfit>[0]);
    expect(profit.apy30d).toBe(scaled);
    expect(profit.apyLifetime).toBe(scaled);
  });
});
