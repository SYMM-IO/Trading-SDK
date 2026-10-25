import axios from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getNotionalCapAll } from "./get-notional-cap-all";
import { getNotionalCapPage } from "./get-notional-cap-page";
import { getNotionalCapPageQueryOptions } from "./query-page";

const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

describe("real generated cap client pagination", () => {
  it("reads 241 rows in server order and sums page-only decimal totals", async () => {
    const offsets: number[] = [];
    axios.defaults.adapter = async (request) => {
      expect(request.url).toBe("/notional_cap");
      expect(request.params.limit).toBe(100);
      const offset = request.params.offset as number;
      offsets.push(offset);
      const symbols = Array.from({ length: Math.min(100, 241 - offset) }, (_, i) => ({
        symbol_id: offset + i + 1,
        used: "0.25",
        open_interest: "0.5",
      }));
      return {
        data: {
          count: symbols.length,
          symbols,
          total_used: symbols.length * 0.25,
          total_open_interest: symbols.length * 0.5,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    };
    const { config } = mockConfig();
    const result = await getNotionalCapAll(config);
    expect(offsets).toEqual([0, 100, 200]);
    expect(result).toMatchObject({ count: 241, totalUsed: 60.25, totalOpenInterest: 120.5 });
    expect(result.symbols.map((s) => s.symbolId)).toEqual(Array.from({ length: 241 }, (_, i) => i + 1));
    expect(result.symbols[0]?.used).toBe(0.25);
  });

  it("requests an empty terminal page for an exact multiple and retains missing-total defaults", async () => {
    const offsets: number[] = [];
    axios.defaults.adapter = async (request) => {
      offsets.push(request.params.offset);
      return {
        data: {
          symbols: request.params.offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ symbol_id: i + 1 })) : [],
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    };
    const { config } = mockConfig();
    expect(await getNotionalCapAll(config)).toMatchObject({ count: 100, totalUsed: 0, totalOpenInterest: 0 });
    expect(offsets).toEqual([0, 100]);
  });

  it("rejects a later-page failure instead of returning partial totals", async () => {
    axios.defaults.adapter = async (request) => {
      if (request.params.offset > 0) throw new Error("second page unavailable");
      return {
        data: { symbols: Array.from({ length: 100 }, (_, i) => ({ symbol_id: i + 1 })) },
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    };
    const { config } = mockConfig();
    await expect(getNotionalCapAll(config)).rejects.toThrow("second page unavailable");
  });

  it("forwards page parameters through the real query factory and separates cache keys", async () => {
    axios.defaults.adapter = async (request) => {
      expect(request.params).toEqual({ limit: 25, offset: 100 });
      return {
        data: { count: 1, total_used: 1.25, symbols: [{ symbol_id: 101 }] },
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    };
    const { config } = mockConfig();
    const query = getNotionalCapPageQueryOptions(config, { limit: 25, offset: 100 });
    expect(query.queryKey).not.toEqual(getNotionalCapPageQueryOptions(config, { limit: 25, offset: 0 }).queryKey);
    expect(await query.queryFn()).toMatchObject({ count: 1, totalUsed: 1.25 });
  });

  it.each([{ limit: 101 }, { limit: 0 }, { offset: -1 }, { offset: 1.5 }])(
    "rejects invalid paging %j",
    async (parameters) => {
      const { config } = mockConfig();
      await expect(getNotionalCapPage(config, parameters)).rejects.toMatchObject({ code: "INVALID_NOTIONAL_CAP_PAGE" });
    },
  );
});
