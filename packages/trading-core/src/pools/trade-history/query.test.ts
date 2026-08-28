import { describe, expect, it } from "vitest";
import { QuoteCloseType } from "../../quotes/get-quote-history/types";
import { mockConfig } from "../../shared/test/mock-config";
import { getPoolTradeHistoryQueryKey, getPoolTradeHistoryQueryOptions } from "./query";

describe("getPoolTradeHistoryQueryKey", () => {
  it("tags the key with the action name and carries the query-defining fields", () => {
    const key = getPoolTradeHistoryQueryKey({
      symbolId: 149,
      closeType: QuoteCloseType.Liquidated,
      configKey: "k",
    });

    expect(key[0]).toBe("getPoolTradeHistory");
    expect(key[1]).toMatchObject({ symbolId: 149, closeType: QuoteCloseType.Liquidated, configKey: "k" });
  });

  it("separates two close-type filters on the same market", () => {
    const all = getPoolTradeHistoryQueryKey({ symbolId: 149, configKey: "k" });
    const liquidated = getPoolTradeHistoryQueryKey({
      symbolId: 149,
      closeType: QuoteCloseType.Liquidated,
      configKey: "k",
    });

    expect(liquidated).not.toEqual(all);
  });
});

describe("getPoolTradeHistoryQueryOptions", () => {
  it("is enabled and wires the action once a market is known", () => {
    const { config } = mockConfig();
    const options = getPoolTradeHistoryQueryOptions(config, { symbolId: 149 });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getPoolTradeHistory");
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled while symbolId is absent — an unlisted pool has no history", () => {
    const { config } = mockConfig();

    expect(getPoolTradeHistoryQueryOptions(config, { symbolId: null }).enabled).toBe(false);
    expect(getPoolTradeHistoryQueryOptions(config, { symbolId: undefined }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(getPoolTradeHistoryQueryOptions(config, { symbolId: 149, query: { enabled: false } }).enabled).toBe(false);
  });
});
