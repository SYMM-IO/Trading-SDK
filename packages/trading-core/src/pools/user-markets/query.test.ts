import { describe, expect, it } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import { getUserListingMarketsQueryKey, getUserListingMarketsQueryOptions } from "./query";

const ACCESS_TOKEN = "eyJhbGc.header.sig";

describe("getUserListingMarketsQueryKey", () => {
  it("tags the key with the action name and carries every filter that shapes the page", () => {
    const key = getUserListingMarketsQueryKey({
      accessToken: ACCESS_TOKEN,
      search: "pepe",
      chainIds: [ListingDepositChainId.SOLANA],
      marketStatus: ListingMarketStatus.LISTED,
      limit: 25,
      offset: 50,
      configKey: "k",
    });

    expect(key[0]).toBe("getUserListingMarkets");
    expect(key[1]).toMatchObject({
      search: "pepe",
      chainIds: [ListingDepositChainId.SOLANA],
      marketStatus: ListingMarketStatus.LISTED,
      limit: 25,
      offset: 50,
    });
  });

  it("keeps the bearer token out of the devtools-visible key", () => {
    const key = getUserListingMarketsQueryKey({ accessToken: ACCESS_TOKEN, configKey: "k" });

    expect(key[1]).not.toHaveProperty("accessToken");
    expect(JSON.stringify(key)).not.toContain(ACCESS_TOKEN);
  });

  it("serializes a bigint filter bound, which TanStack's key hash would otherwise throw on", () => {
    const key = getUserListingMarketsQueryKey({
      accessToken: ACCESS_TOKEN,
      filters: { tvl: { min: 1000000000000000000n } },
      configKey: "k",
    });

    expect(() => JSON.stringify(key)).not.toThrow();
    expect(key[1]).toMatchObject({ filters: { tvl: { min: "1000000000000000000" } } });
  });

  it("separates two pages of the same filter", () => {
    const params = { accessToken: ACCESS_TOKEN, limit: 25, configKey: "k" };

    expect(getUserListingMarketsQueryKey({ ...params, offset: 25 })).not.toEqual(
      getUserListingMarketsQueryKey({ ...params, offset: 0 }),
    );
  });
});

describe("getUserListingMarketsQueryOptions", () => {
  it("is enabled by default and wires the action", () => {
    const { config } = mockConfig();
    const options = getUserListingMarketsQueryOptions(config, { accessToken: ACCESS_TOKEN });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getUserListingMarkets");
    expect(typeof options.queryFn).toBe("function");
  });

  it("respects an explicit query.enabled = false", () => {
    const { config } = mockConfig();

    expect(
      getUserListingMarketsQueryOptions(config, { accessToken: ACCESS_TOKEN, query: { enabled: false } }).enabled,
    ).toBe(false);
  });
});
