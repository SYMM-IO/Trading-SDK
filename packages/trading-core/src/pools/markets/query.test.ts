import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";

const marketSearchV2MarketSearchGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    marketSearchV2MarketSearchGet,
  };
});

import { getListingMarketsQueryKey, getListingMarketsQueryOptions } from "./query";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getListingMarketsQueryKey", () => {
  it("separates two searches that differ only by a filter bound", () => {
    const a = getListingMarketsQueryKey({ configKey: "k", filters: { tvl: { min: 1n } } });
    const b = getListingMarketsQueryKey({ configKey: "k", filters: { tvl: { min: 2n } } });

    expect(a).not.toEqual(b);
  });

  it("separates two pages of the same search", () => {
    const a = getListingMarketsQueryKey({ configKey: "k", offset: 0 });
    const b = getListingMarketsQueryKey({ configKey: "k", offset: 20 });

    expect(a).not.toEqual(b);
  });

  it("separates the same search across two config scopes", () => {
    expect(getListingMarketsQueryKey({ configKey: "a" })).not.toEqual(getListingMarketsQueryKey({ configKey: "b" }));
  });
});

describe("getListingMarketsQueryOptions", () => {
  beforeEach(() => {
    marketSearchV2MarketSearchGet.mockReset();
  });

  it("is enabled by default and takes no required parameters", () => {
    const { config } = mockConfig();

    expect(getListingMarketsQueryOptions(config).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();

    expect(getListingMarketsQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("forwards every search parameter to the service", async () => {
    const { config } = mockConfig();
    marketSearchV2MarketSearchGet.mockResolvedValue({ data: { total: 0, limit: 20, offset: 0, items: [] } });

    await getListingMarketsQueryOptions(config, {
      search: "pepe",
      chainIds: [ListingDepositChainId.BASE],
      marketStatus: ListingMarketStatus.LISTED,
      limit: 50,
      offset: 100,
      sortBy: "tvl",
      orderBy: "asc",
      filters: { tvl: { min: 1n } },
    }).queryFn();

    expect(marketSearchV2MarketSearchGet).toHaveBeenCalledWith(
      {
        query: "pepe",
        chain_ids: [ListingDepositChainId.BASE],
        market_status: ListingMarketStatus.LISTED,
        limit: 50,
        offset: 100,
        sort_by: "tvl",
        order_by: "asc",
        tvl__ge: "1",
      },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
  });

  it("serializes array params as repeated keys, not the bracket form the service ignores", async () => {
    const { config } = mockConfig();
    marketSearchV2MarketSearchGet.mockResolvedValue({ data: {} });

    await getListingMarketsQueryOptions(config, { chainIds: [ListingDepositChainId.BASE] }).queryFn();

    const requestConfig = marketSearchV2MarketSearchGet.mock.calls[0]?.[1];
    expect(requestConfig?.paramsSerializer).toEqual({ indexes: null });
  });

  it("normalizes the response into ListingMarket rows", async () => {
    const { config } = mockConfig();
    marketSearchV2MarketSearchGet.mockResolvedValue({
      data: {
        total: 1,
        limit: 20,
        offset: 0,
        items: [
          {
            contract_address: "0xabc",
            chain_id: ListingDepositChainId.BASE,
            symbol_id: 1,
            token_ticker: "SYMM",
            token_name: "Symmio",
            max_leverage: 18,
            tvl: "71036417337070986131",
            market_status: "listed",
          },
        ],
      },
    });

    const page = await getListingMarketsQueryOptions(config).queryFn();

    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      tokenTicker: "SYMM",
      tvl: 71036417337070986131n,
      marketStatus: ListingMarketStatus.LISTED,
      marketCap: null,
    });
  });

  it("throws rather than reading another chain's catalog when the chain has no listing backend", async () => {
    const config = createConfig({
      symmioConfig: {
        [SymmioSupportedChainId.BASE]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } },
        [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } },
      },
      getClient: () => ({}) as PublicClient,
      defaultChainId: SymmioSupportedChainId.BASE,
    });

    await expect(getListingMarketsQueryOptions(config).queryFn()).rejects.toThrow(SymmError);
    await expect(getListingMarketsQueryOptions(config).queryFn()).rejects.toMatchObject({
      code: "LISTING_NOT_CONFIGURED",
    });
    expect(marketSearchV2MarketSearchGet).not.toHaveBeenCalled();
  });
});
