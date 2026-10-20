import axios from "axios";
import { afterEach, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getFundingInfoQueryOptions } from "../funding-info/query";
import { getMarketInfo } from "./get-market-info";

const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

it("uses the generated ID endpoints and retains distinct IDs even when tickers match", async () => {
  const urls: string[] = [];
  axios.defaults.adapter = async (request) => {
    urls.push(request.url!);
    if (request.url === "/funding-info") {
      expect(request.params.symbol_ids).toEqual([12, 34]);
      return {
        data: { "12": { next_funding_rate_long: "0.001" }, "34": { next_funding_rate_long: "0.002" }, bad: null },
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    }
    expect(request.url).toBe("/market-info");
    return {
      data: {
        "12": { symbol: "PEPE", trading_volume: 10 },
        "34": { symbol: "PEPE", trading_volume: 20 },
        total_value_24h: 30,
        unknown: {},
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: request,
    };
  };
  const { config } = mockConfig();
  const market = await getMarketInfo(config, { solverId: "enigma" });
  expect(market.markets).toEqual([
    { symbolId: 12, tradingVolume: 10, lifetimeValue: 0 },
    { symbolId: 34, tradingVolume: 20, lifetimeValue: 0 },
  ]);
  expect(market.totalValue24h).toBe(30);
  const query = getFundingInfoQueryOptions(config, { solverId: "enigma", symbolIds: [12, 34] });
  expect(query.queryKey).not.toEqual(getFundingInfoQueryOptions(config, { symbolIds: [12] }).queryKey);
  expect((await query.queryFn()).map((row) => [row.symbolId, row.nextFundingRateLong])).toEqual([
    [12, 0.001],
    [34, 0.002],
  ]);
  expect(urls).toEqual(["/market-info", "/funding-info"]);
});
