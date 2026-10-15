import { QueryClient } from "@tanstack/query-core";
import axios from "axios";
import type { PublicClient } from "viem";
import { afterEach, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { getTradeVolume } from "./get-trade-volume";
import { getTradeVolumeQueryOptions } from "./query";

const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

it("keeps defaults compatible and separates opt-in omission in action and query caches", async () => {
  const config = createConfig({ getClient: () => ({}) as PublicClient, symmioConfig: {} });
  const timestamp = "2026-07-09T00:00:00Z";
  axios.defaults.adapter = async (request) => ({
    config: request,
    status: 200,
    statusText: "OK",
    headers: {},
    data: [
      { timestamp },
      { timestamp, volume: "0" },
      { timestamp, volume: null },
      { timestamp, volume: "0.100000000000000001" },
      null,
    ],
  });
  const parameters = { symbolId: 267, chainId: 42161, solverId: "enigma" as const };
  const defaults = await getTradeVolume(config, parameters);
  expect(defaults.map((row) => row.volume)).toEqual(["0", "0", "0", "0.100000000000000001"]);
  const client = new QueryClient();
  try {
    const normal = getTradeVolumeQueryOptions(config, parameters);
    const omit = getTradeVolumeQueryOptions(config, { ...parameters, missingVolume: "omit" });
    expect(normal.queryKey).not.toEqual(omit.queryKey);
    expect(await client.fetchQuery(normal)).toEqual(defaults);
    expect(await client.fetchQuery(omit)).toEqual(defaults.slice(1));
    expect(await getTradeVolume(config, { ...parameters, missingVolume: "zero" })).toEqual(defaults);
  } finally {
    client.clear();
  }
});
