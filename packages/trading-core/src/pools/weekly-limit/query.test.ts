import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getWeeklyListingLimitQueryKey, getWeeklyListingLimitQueryOptions } from "./query";

describe("getWeeklyListingLimitQueryKey", () => {
  it("tags the key with the action name; the cap is protocol-global, not per user", () => {
    const key = getWeeklyListingLimitQueryKey({ configKey: "k" });

    expect(key[0]).toBe("getWeeklyListingLimit");
    expect(key[1]).toEqual({ configKey: "k" });
  });

  it("separates two chains through the config key", () => {
    expect(getWeeklyListingLimitQueryKey({ configKey: "base" })).not.toEqual(
      getWeeklyListingLimitQueryKey({ configKey: "hyper" }),
    );
  });
});

describe("getWeeklyListingLimitQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getWeeklyListingLimitQueryOptions(config, {});

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getWeeklyListingLimit");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(getWeeklyListingLimitQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });
});
