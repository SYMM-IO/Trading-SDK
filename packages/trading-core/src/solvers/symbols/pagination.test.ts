import axios from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getSymbols } from "./get-symbols";
import { getSymbolsQueryOptions } from "./query";

const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

describe("real generated symbol client pagination", () => {
  it("retrieves >500 symbols with duplicate tickers, retaining filters and server order", async () => {
    const offsets: number[] = [];
    axios.defaults.adapter = async (request) => {
      expect(request.url).toBe("/symbols");
      expect(request.params).toMatchObject({ limit: 500, search: "PEPE", is_valid: "any", state_long: "enabled" });
      const offset = request.params.offset as number;
      offsets.push(offset);
      const symbols = Array.from({ length: offset === 0 ? 500 : 2 }, (_, i) => ({
        symbol_id: offset + i + 1,
        name: `PEPE::${offset + i + 1}`,
        symbol: "PEPE",
        state_long: 3,
        state_short: 2,
      }));
      return { data: { count: symbols.length, symbols }, status: 200, statusText: "OK", headers: {}, config: request };
    };
    const { config } = mockConfig();
    const result = await getSymbolsQueryOptions(config, {
      search: "PEPE",
      isValid: "any",
      stateLong: "enabled",
    }).queryFn();
    expect(offsets).toEqual([0, 500]);
    expect(result).toHaveLength(502);
    expect(result.map((row) => row.symbolId)).toEqual(Array.from({ length: 502 }, (_, i) => i + 1));
    expect(result.at(-1)).toMatchObject({ name: "PEPE::502", symbol: "PEPE" });
  });

  it.each([{ limit: 25 }, { offset: 0 }, { limit: 100, offset: 100 }])(
    "keeps explicit pagination single-page: %j",
    async (parameters) => {
      let calls = 0;
      axios.defaults.adapter = async (request) => {
        calls++;
        expect(request.params).toMatchObject(parameters);
        return {
          data: { symbols: [{ symbol_id: 2, name: "NEW", symbol: "NEW" }] },
          status: 200,
          statusText: "OK",
          headers: {},
          config: request,
        };
      };
      const { config } = mockConfig();
      expect(await getSymbols(config, parameters)).toHaveLength(1);
      expect(calls).toBe(1);
    },
  );

  it("rejects a later-page failure without returning a partial catalog", async () => {
    axios.defaults.adapter = async (request) => {
      if (request.params.offset > 0) throw new Error("later page unavailable");
      return {
        data: { symbols: Array.from({ length: 500 }, (_, i) => ({ symbol_id: i + 1, name: `M${i}` })) },
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    };
    const { config } = mockConfig();
    await expect(getSymbols(config)).rejects.toThrow("later page unavailable");
  });
});
