import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getInventoryTvlHistoryQueryKey, getInventoryTvlHistoryQueryOptions } from "./query";

const SYMBOL_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

describe("getInventoryTvlHistoryQueryKey", () => {
  it("tags the key with the action name and carries the market's symbol address", () => {
    const key = getInventoryTvlHistoryQueryKey({ symbolAddress: SYMBOL_ADDRESS, configKey: "k" });

    expect(key[0]).toBe("getInventoryTvlHistory");
    expect(key[1]).toMatchObject({ symbolAddress: SYMBOL_ADDRESS, configKey: "k" });
  });

  it("separates two markets", () => {
    const first = getInventoryTvlHistoryQueryKey({ symbolAddress: SYMBOL_ADDRESS, configKey: "k" });
    const second = getInventoryTvlHistoryQueryKey({
      symbolAddress: "0x1111111111111111111111111111111111111111",
      configKey: "k",
    });

    expect(second).not.toEqual(first);
  });

  it("separates two chains on the same market, since the key carries the config scope", () => {
    const first = getInventoryTvlHistoryQueryKey({ symbolAddress: SYMBOL_ADDRESS, configKey: "hyper" });
    const second = getInventoryTvlHistoryQueryKey({ symbolAddress: SYMBOL_ADDRESS, configKey: "base" });

    expect(second).not.toEqual(first);
  });
});

describe("getInventoryTvlHistoryQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getInventoryTvlHistoryQueryOptions(config, { symbolAddress: SYMBOL_ADDRESS });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getInventoryTvlHistory");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(
      getInventoryTvlHistoryQueryOptions(config, { symbolAddress: SYMBOL_ADDRESS, query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("drops TanStack control fields from the key, so staleTime does not split the cache", () => {
    const { config } = mockConfig();
    const plain = getInventoryTvlHistoryQueryOptions(config, { symbolAddress: SYMBOL_ADDRESS });
    const tuned = getInventoryTvlHistoryQueryOptions(config, {
      symbolAddress: SYMBOL_ADDRESS,
      query: { staleTime: 60_000 },
    });

    expect(tuned.queryKey).toEqual(plain.queryKey);
  });
});
