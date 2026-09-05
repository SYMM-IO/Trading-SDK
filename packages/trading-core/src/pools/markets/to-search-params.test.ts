import { describe, expect, it } from "vitest";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import { toFilterParams, toSearchParams } from "./to-search-params";

describe("toFilterParams", () => {
  it("returns nothing when no filters are given", () => {
    expect(toFilterParams()).toEqual({});
    expect(toFilterParams({})).toEqual({});
  });

  it("maps a range onto the service's __ge / __le suffixes", () => {
    expect(toFilterParams({ marketCap: { min: 1n, max: 2n } })).toEqual({
      market_cap__ge: "1",
      market_cap__le: "2",
    });
  });

  it("supports a one-sided bound", () => {
    expect(toFilterParams({ tvl: { min: 5n } })).toEqual({ tvl__ge: "5" });
    expect(toFilterParams({ tvl: { max: 5n } })).toEqual({ tvl__le: "5" });
  });

  it("stringifies bigint bounds so an 18-decimal value is not rounded by Number", () => {
    const bound = 1_000_000n * 10n ** 18n;
    const params = toFilterParams({ marketCap: { min: bound } });

    expect(params.market_cap__ge).toBe("1000000000000000000000000");
    expect(Number(params.market_cap__ge)).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });

  it("sends a zero bound rather than dropping it as falsy", () => {
    expect(toFilterParams({ apr: { min: 0n } })).toEqual({ apr__ge: "0" });
  });

  it("maps every filter key to the wire field the service actually accepts", () => {
    const params = toFilterParams({
      marketCap: { min: 1n },
      vol24h: { min: 1n },
      tvl: { min: 1n },
      liquidity: { min: 1n },
      openInterest: { min: 1n },
      reward24h: { min: 1n },
      apr: { min: 1n },
      apr1h: { min: 1n },
      apr6h: { min: 1n },
      apr24h: { min: 1n },
      apr30d: { min: 1n },
      tvlDrivenApy1h: { min: 1n },
      tvlDrivenApy6h: { min: 1n },
      tvlDrivenApy24h: { min: 1n },
      tvlDrivenApy30d: { min: 1n },
      tvlDrivenApy: { min: 1n },
      priceDrivenApy1h: { min: 1n },
      priceDrivenApy6h: { min: 1n },
      priceDrivenApy24h: { min: 1n },
      priceDrivenApy30d: { min: 1n },
      priceDrivenApy: { min: 1n },
      listingTime: { min: 1 },
    });

    expect(Object.keys(params).sort()).toEqual(
      [
        "apr__ge",
        "apr_1h__ge",
        "apr_6h__ge",
        "apr_24h__ge",
        "apr_30d__ge",
        "liquidity__ge",
        "listing_time__ge",
        "market_cap__ge",
        "open_interest__ge",
        "price_driven_apy__ge",
        "price_driven_apy_1h__ge",
        "price_driven_apy_6h__ge",
        "price_driven_apy_24h__ge",
        "price_driven_apy_30d__ge",
        "reward_24h__ge",
        "tvl__ge",
        "tvl_driven_apy__ge",
        "tvl_driven_apy_1h__ge",
        "tvl_driven_apy_6h__ge",
        "tvl_driven_apy_24h__ge",
        "tvl_driven_apy_30d__ge",
        "vol24h__ge",
      ].sort(),
    );
  });
});

describe("toSearchParams", () => {
  it("omits every unset input so the service applies its own defaults", () => {
    expect(toSearchParams({})).toEqual({});
  });

  it("renames search to the wire's query param", () => {
    expect(toSearchParams({ query: "pepe" })).toEqual({ query: "pepe" });
  });

  it("passes chain ids as an array for the repeat serializer", () => {
    const params = toSearchParams({
      chainIds: [ListingDepositChainId.SOLANA, ListingDepositChainId.BASE],
    });

    expect(params.chain_ids).toEqual([0, 8453]);
  });

  it("copies a readonly chainIds input rather than aliasing it", () => {
    const chainIds = [ListingDepositChainId.BASE] as const;
    const params = toSearchParams({ chainIds });

    expect(params.chain_ids).toEqual([8453]);
    expect(params.chain_ids).not.toBe(chainIds);
  });

  it("carries pagination, sort, and status through", () => {
    expect(
      toSearchParams({
        marketStatus: ListingMarketStatus.LISTED,
        limit: 50,
        offset: 100,
        sortBy: "tvl",
        orderBy: "asc",
      }),
    ).toEqual({
      market_status: "listed",
      limit: 50,
      offset: 100,
      sort_by: "tvl",
      order_by: "asc",
    });
  });

  it("sends offset 0 rather than dropping it as falsy", () => {
    expect(toSearchParams({ offset: 0 })).toEqual({ offset: 0 });
  });

  it("merges filters alongside the other params", () => {
    expect(toSearchParams({ sortBy: "tvl", filters: { tvl: { min: 1n } } })).toEqual({
      sort_by: "tvl",
      tvl__ge: "1",
    });
  });
});
