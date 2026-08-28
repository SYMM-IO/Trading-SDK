import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getInventoryTvlQueryKey, getInventoryTvlQueryOptions } from "./query";

describe("getInventoryTvlQueryKey", () => {
  it("tags the key with the action name; the figure is system-wide, so it takes no market", () => {
    const key = getInventoryTvlQueryKey({ configKey: "k" });

    expect(key[0]).toBe("getInventoryTvl");
    expect(key[1]).toEqual({ configKey: "k" });
  });

  it("separates two chains through the config key", () => {
    expect(getInventoryTvlQueryKey({ configKey: "base" })).not.toEqual(getInventoryTvlQueryKey({ configKey: "hyper" }));
  });
});

describe("getInventoryTvlQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getInventoryTvlQueryOptions(config, {});

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getInventoryTvl");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(getInventoryTvlQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });
});
