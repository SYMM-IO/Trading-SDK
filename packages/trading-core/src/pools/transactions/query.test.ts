import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getPoolTransactionsQueryKey, getPoolTransactionsQueryOptions } from "./query";

const MARKET_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";
const WALLET = "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";

describe("getPoolTransactionsQueryKey", () => {
  it("tags the key with the action name and carries the query-defining fields", () => {
    const key = getPoolTransactionsQueryKey({ marketAddress: MARKET_ADDRESS, start: 50, size: 25, configKey: "k" });

    expect(key[0]).toBe("getPoolTransactions");
    expect(key[1]).toMatchObject({ marketAddress: MARKET_ADDRESS, start: 50, size: 25, configKey: "k" });
  });

  it("separates the pool-wide page from a wallet-filtered one", () => {
    const poolWide = getPoolTransactionsQueryKey({ marketAddress: MARKET_ADDRESS, configKey: "k" });
    const scoped = getPoolTransactionsQueryKey({
      marketAddress: MARKET_ADDRESS,
      walletAddress: WALLET,
      configKey: "k",
    });

    expect(scoped).not.toEqual(poolWide);
  });

  it("separates pages, so paging does not overwrite one cache entry", () => {
    const first = getPoolTransactionsQueryKey({ marketAddress: MARKET_ADDRESS, start: 0, size: 25, configKey: "k" });
    const second = getPoolTransactionsQueryKey({ marketAddress: MARKET_ADDRESS, start: 25, size: 25, configKey: "k" });

    expect(second).not.toEqual(first);
  });
});

describe("getPoolTransactionsQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getPoolTransactionsQueryOptions(config, { marketAddress: MARKET_ADDRESS });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getPoolTransactions");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(
      getPoolTransactionsQueryOptions(config, { marketAddress: MARKET_ADDRESS, query: { enabled: false } }).enabled,
    ).toBe(false);
  });
});
