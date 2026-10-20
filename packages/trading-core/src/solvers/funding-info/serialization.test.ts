import axios from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getFundingInfo } from "./get-funding-info";
import { getFundingInfoQueryOptions } from "./query";

const originalAdapter = axios.defaults.adapter;

afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

describe.each(["action", "query"] as const)("funding %s request serialization", (entryPoint) => {
  it.each([
    { symbolIds: [12], expectedSearch: "?symbol_ids=12", expectedIds: [12] },
    { symbolIds: [12, 34], expectedSearch: "?symbol_ids=12&symbol_ids=34", expectedIds: [12, 34] },
    { symbolIds: undefined, expectedSearch: "", expectedIds: [12, 34, 56] },
  ])("preserves the server filter for $symbolIds", async ({ symbolIds, expectedSearch, expectedIds }) => {
    const urls: URL[] = [];
    axios.defaults.adapter = async (request) => {
      const url = new URL(axios.getUri(request));
      urls.push(url);
      // The server only recognizes repeated, unbracketed symbol_ids keys.
      const filter = url.searchParams.getAll("symbol_ids").map(Number);
      const ids = [12, 34, 56].filter((id) => filter.length === 0 || filter.includes(id));
      return {
        data: Object.fromEntries(ids.map((id) => [String(id), { next_funding_rate_long: "0.001" }])),
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    };
    const { config } = mockConfig();
    const parameters = { solverId: "enigma" as const, symbolIds };
    const result = await (entryPoint === "action"
      ? getFundingInfo(config, parameters)
      : getFundingInfoQueryOptions(config, parameters).queryFn());

    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe("/api/funding-info");
    expect(urls[0]?.search).toBe(expectedSearch);
    expect(result.map((row) => row.symbolId)).toEqual(expectedIds);
  });
});
