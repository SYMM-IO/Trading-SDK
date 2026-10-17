import axios from "axios";
import { afterEach, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getTradeVolume } from "./get-trade-volume";
import { getTradeVolumeQueryOptions } from "./query";

const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

it("real action and query skip malformed rows while retaining true zero and exact decimal strings", async () => {
  const timestamp = "2026-10-17T00:00:00Z";
  const valid = [
    { timestamp, volume: "0" },
    { timestamp, volume: "448.699250908231105583" },
  ];
  axios.defaults.adapter = async (request) => {
    expect(request.url).toBe("/trade-volume/12");
    return {
      data: [
        null,
        {},
        { timestamp },
        { timestamp, volume: null },
        { timestamp, volume: "" },
        { timestamp, volume: "Infinity" },
        { timestamp: "bad", volume: "1" },
        ...valid,
      ],
      status: 200,
      statusText: "OK",
      headers: {},
      config: request,
    };
  };
  const { config } = mockConfig();
  expect(await getTradeVolume(config, { symbolId: 12 })).toEqual(valid);
  expect(await getTradeVolumeQueryOptions(config, { symbolId: 12 }).queryFn()).toEqual(valid);
});
