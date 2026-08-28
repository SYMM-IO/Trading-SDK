import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { POOL_OPEN_QUOTE_STATUSES } from "./get-pool-quotes";
import { getPoolQuotesQueryKey, getPoolQuotesQueryOptions } from "./query";

describe("getPoolQuotesQueryKey", () => {
  it("tags the key with the action name and carries the query-defining fields", () => {
    const key = getPoolQuotesQueryKey({
      symbolId: 149,
      quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
      configKey: "k",
    });

    expect(key[0]).toBe("getPoolQuotes");
    expect(key[1]).toMatchObject({ symbolId: 149, quoteStatuses: POOL_OPEN_QUOTE_STATUSES, configKey: "k" });
  });

  it("separates two status filters on the same market, so tabs do not share a cache entry", () => {
    const pending = getPoolQuotesQueryKey({ symbolId: 149, configKey: "k" });
    const open = getPoolQuotesQueryKey({ symbolId: 149, quoteStatuses: POOL_OPEN_QUOTE_STATUSES, configKey: "k" });

    expect(open).not.toEqual(pending);
  });
});

describe("getPoolQuotesQueryOptions", () => {
  it("is enabled and wires the action once a market is known", () => {
    const { config } = mockConfig();
    const options = getPoolQuotesQueryOptions(config, { symbolId: 149 });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getPoolQuotes");
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled while symbolId is absent — an unlisted pool has no book", () => {
    const { config } = mockConfig();

    expect(getPoolQuotesQueryOptions(config, { symbolId: null }).enabled).toBe(false);
    expect(getPoolQuotesQueryOptions(config, { symbolId: undefined }).enabled).toBe(false);
  });

  it("stays enabled for symbolId 0", () => {
    const { config } = mockConfig();

    expect(getPoolQuotesQueryOptions(config, { symbolId: 0 }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(getPoolQuotesQueryOptions(config, { symbolId: 149, query: { enabled: false } }).enabled).toBe(false);
  });
});
