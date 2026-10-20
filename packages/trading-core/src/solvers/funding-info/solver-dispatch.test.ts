import axios from "axios";
import { afterEach, expect, expectTypeOf, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getFundingInfo } from "./get-funding-info";
import { getFundingInfoQueryOptions } from "./query";
import type { EnigmaMarketFundingInfo, RasaMarketFundingInfo } from "./types";
const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});
const wire = {
  next_funding_rate_long: "-0.000046032",
  next_funding_rate_short: "0.000030688",
  next_funding_time: 1792483200000,
  funding_rate_epoch_duration: 14400,
};
it.each(["action", "query"] as const)(
  "preserves Rasa default-chain reads and ticker filtering through %s",
  async (entry) => {
    const { config } = mockConfig();
    const urls: URL[] = [];
    axios.defaults.adapter = async (request) => {
      const url = new URL(axios.getUri(request));
      urls.push(url);
      expect(url.pathname).toBe("/get_funding_info");
      expect(url.hostname).toBe("stage-archon.rasa.capital");
      return { data: { IOSTUSDT: wire }, status: 200, statusText: "OK", headers: {}, config: request };
    };
    const parameters = { chainId: 8453 };
    const all = await (entry === "action"
      ? getFundingInfo(config, parameters)
      : getFundingInfoQueryOptions(config, parameters).queryFn());
    expect(all).toEqual([
      {
        kind: "rasa",
        symbol: "IOSTUSDT",
        nextFundingRateLong: -0.000046032,
        nextFundingRateShort: 0.000030688,
        nextFundingTime: 1792483200000,
        epochDurationSeconds: 14400,
      },
    ]);
    expect(urls[0]?.search).toBe("");
    const filtered = { chainId: 8453, solverId: "rasa" as const, symbols: ["IOSTUSDT", "BTCUSDT"] };
    const rows = await (entry === "action"
      ? getFundingInfo(config, filtered)
      : getFundingInfoQueryOptions(config, filtered).queryFn());
    expectTypeOf(rows).toEqualTypeOf<RasaMarketFundingInfo[]>();
    expect(urls[1]?.search).toBe("?symbols=IOSTUSDT&symbols=BTCUSDT");
    expect(rows[0]?.symbol).toBe("IOSTUSDT");
  },
);
it("narrows Enigma data and isolates filters/deployments in query keys", () => {
  const { config } = mockConfig();
  const enigma = getFundingInfoQueryOptions(config, { solverId: "enigma", symbolIds: [12] });
  expectTypeOf(enigma.queryFn).returns.toEqualTypeOf<Promise<EnigmaMarketFundingInfo[]>>();
  const rasa = getFundingInfoQueryOptions(config, { chainId: 8453, solverId: "rasa", symbols: ["BTCUSDT"] });
  expectTypeOf(rasa.queryFn).returns.toEqualTypeOf<Promise<RasaMarketFundingInfo[]>>();
  expect(rasa.queryKey).not.toEqual(enigma.queryKey);
  expect(rasa.queryKey).not.toEqual(
    getFundingInfoQueryOptions(config, { chainId: 8453, symbols: ["ETHUSDT"] }).queryKey,
  );
});
it("rejects filters for the wrong solver before sending a request", async () => {
  const adapter = vi.fn();
  axios.defaults.adapter = adapter;
  const { config } = mockConfig();
  await expect(getFundingInfo(config, { chainId: 8453, symbolIds: [12] })).rejects.toMatchObject({
    code: "INVALID_FUNDING_FILTER",
  });
  await expect(getFundingInfo(config, { solverId: "enigma", symbols: ["BTCUSDT"] })).rejects.toMatchObject({
    code: "INVALID_FUNDING_FILTER",
  });
  expect(adapter).not.toHaveBeenCalled();
});
