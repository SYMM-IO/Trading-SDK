import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getListingConfigQueryKey, getListingConfigQueryOptions } from "./query";

describe("getListingConfigQueryKey", () => {
  it("builds a key with no parameters at all — the read is public and chain-scoped", () => {
    const key = getListingConfigQueryKey();

    expect(key[0]).toBe("getListingConfig");
    expect(key[1]).toEqual({});
  });

  it("separates two chains through the config key", () => {
    const hyper = getListingConfigQueryKey({ configKey: "hyper" });
    const base = getListingConfigQueryKey({ configKey: "base" });

    expect(base).not.toEqual(hyper);
  });
});

describe("getListingConfigQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getListingConfigQueryOptions(config, {});

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getListingConfig");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(getListingConfigQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("drops TanStack control fields from the key, so staleTime does not split the cache", () => {
    const { config } = mockConfig();

    expect(getListingConfigQueryOptions(config, { query: { staleTime: 60_000 } }).queryKey).toEqual(
      getListingConfigQueryOptions(config, {}).queryKey,
    );
  });
});
