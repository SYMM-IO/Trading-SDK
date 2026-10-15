import axios, { type AxiosAdapter } from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig } from "../core/config";
import { getAllSymbols } from "./get-all-symbols/get-all-symbols";
import { getEnigmaFundingInfo } from "./get-enigma-funding-info/get-enigma-funding-info";
import { getEnigmaMarketInfo } from "./get-enigma-market-info/get-enigma-market-info";
import { getNotionalCapSnapshot } from "./get-notional-cap-snapshot/get-notional-cap-snapshot";

const original = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = original;
});
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    42161: {
      addresses: { affiliatesAddress: "0x0000000000000000000000000000000000000000" },
      solvers: { enigma: { url: "https://test.invalid/api" } },
    },
  },
});
const parameters = { chainId: 42161, solverId: "enigma" as const };
function respond(read: (url: string, params: Record<string, unknown>) => unknown) {
  const adapter: AxiosAdapter = async (request) => ({
    data: read(request.url!, request.params ?? {}),
    status: 200,
    statusText: "OK",
    headers: {},
    config: request,
  });
  axios.defaults.adapter = adapter;
}
function cap(id: number, used = "0.100000000000000001") {
  return {
    symbol_id: id,
    symbol: "DUP",
    used,
    total_cap: "10",
    available_to_long: "4",
    available_to_short: "5",
    open_interest: "1",
    price: "1",
    token_balance: "1",
    usdc_balance: "1",
    error: null,
  };
}
describe("market read parity", () => {
  it("keeps volume and funding attached to numeric IDs even for duplicate tickers", async () => {
    respond((url) =>
      url === "/market-info"
        ? {
            1: { trading_volume: 12, lifetime_value: 40 },
            2: { trading_volume: 34, lifetime_value: 60 },
            total_value_24h: 46,
          }
        : {
            1: { next_funding_time: 10, next_funding_rate_long: "0.000000000000000001" },
            2: { next_funding_time: 20, next_funding_rate_long: "-0.1" },
          },
    );
    expect(await getEnigmaMarketInfo(config, parameters)).toEqual({
      1: { tradingVolume: 12, lifetimeValue: 40 },
      2: { tradingVolume: 34, lifetimeValue: 60 },
    });
    expect((await getEnigmaFundingInfo(config, parameters)).map((row) => [row.symbolId, row.fundingRate])).toEqual([
      [1, "0.000000000000000001"],
      [2, "-0.1"],
    ]);
  });
  it("walks all cap pages and sums exact decimal aggregates", async () => {
    const offsets: number[] = [];
    respond((_url, params) => {
      offsets.push(Number(params.offset));
      return {
        count: 2,
        symbols: [cap(Number(params.offset) + 1)],
        total_used: "0.100000000000000001",
        total_open_interest: "1",
      };
    });
    const result = await getNotionalCapSnapshot(config, parameters);
    expect(offsets).toEqual([0, 1]);
    expect(result.symbols.map((row) => row.symbolId)).toEqual([1, 2]);
    expect(result.totalUsed).toBe("0.200000000000000002");
    expect(result.symbols[0]?.used).toBe("0.100000000000000001");
  });
  it("does not turn a missing page aggregate into zero", async () => {
    respond((_url, params) => ({
      count: 2,
      symbols: [cap(Number(params.offset) + 1)],
      ...(params.offset === 0 ? { total_used: "1" } : {}),
    }));
    expect((await getNotionalCapSnapshot(config, parameters)).totalUsed).toBeUndefined();
  });
  it("keeps per-side state and follows short pages until count is satisfied", async () => {
    respond((_url, params) => ({
      count: 2,
      symbols: [
        {
          symbol_id: Number(params.offset) + 1,
          name: `DUP-${params.offset}`,
          symbol: "DUP",
          state_long: 1,
          state_short: 3,
        },
      ],
    }));
    expect(
      (await getAllSymbols(config, parameters)).map((row) => [row.symbolId, row.stateLong, row.stateShort]),
    ).toEqual([
      [1, 1, 3],
      [2, 1, 3],
    ]);
  });
  it("rejects repeated pages rather than returning incomplete or duplicated caps", async () => {
    respond(() => ({ count: 2, symbols: [cap(1)] }));
    await expect(getNotionalCapSnapshot(config, parameters)).rejects.toThrow(/progress/i);
  });
});
