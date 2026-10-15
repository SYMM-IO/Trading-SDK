import axios, { type AxiosAdapter } from "axios";
import type { PublicClient } from "viem";
import { afterEach, expect, it } from "vitest";
import { createConfig } from "../core/config";
import { getListingMarketSnapshot } from "./get-listing-market-snapshot/get-listing-market-snapshot";
const previous = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = previous;
});
it("preserves fractional metrics, legacy percentages, missing values and all server filters", async () => {
  const adapter: AxiosAdapter = async (request) => {
    expect(request.baseURL).toBe("https://listing.test");
    expect(request.url).toBe("/v2/market/search");
    expect(request.params).toMatchObject({
      chain_ids: [0, 8453],
      is_locked: false,
      apr_24h__ge: "12345678901234567890",
      listing_time__le: "100",
      order_by: "desc",
    });
    expect(request.paramsSerializer).toEqual({ indexes: null });
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      config: request,
      data: {
        total: 1,
        limit: 50,
        offset: 0,
        items: [
          {
            contract_address: "Token",
            chain_id: 0,
            symbol_id: 117,
            token_ticker: "DUP",
            token_name: "Duplicate",
            max_leverage: 10,
            market_status: "listed",
            is_locked: false,
            market_cap: "12345678901234567890.00001",
            apr: "0.125",
            apr_30d: null,
            apy_30d: "0E-36",
            reward_lifetime: "1.23456789",
            solver_revenue_24h: "0",
          },
        ],
      },
    };
  };
  axios.defaults.adapter = adapter;
  const config = createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      42161: {
        addresses: { affiliatesAddress: "0x0000000000000000000000000000000000000000" },
        listing: { url: "https://listing.test" },
      },
    },
  });
  const page = await getListingMarketSnapshot(config, {
    chainId: 42161,
    limit: 50,
    chainIds: [0, 8453],
    isLocked: false,
    orderBy: "desc",
    filters: { apr24h: { min: 12345678901234567890n }, listingTime: { max: 100 } },
  });
  expect(page.items[0]).toMatchObject({
    symbolId: 117,
    marketCap: "12345678901234567890.00001",
    apr: "0.125",
    apr30d: null,
    apy30d: "0E-36",
    rewardLifetime: "1.23456789",
    solverRevenue24h: "0",
    isLocked: false,
  });
  expect(page.items[0]?.vol24h).toBeUndefined();
});
