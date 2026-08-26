import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";

const marketUserSearchV2MarketSearchUserGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    marketUserSearchV2MarketSearchUserGet,
  };
});

import { getUserListingMarkets } from "./get-user-listing-markets";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getUserListingMarkets", () => {
  beforeEach(() => {
    marketUserSearchV2MarketSearchUserGet.mockReset();
  });

  it("forwards every search parameter and the bearer token to the enigma listing endpoint", async () => {
    const { config } = mockConfig();
    marketUserSearchV2MarketSearchUserGet.mockResolvedValue({ data: { total: 0, limit: 20, offset: 0, items: [] } });

    await getUserListingMarkets(config, {
      accessToken: "TOKEN123",
      search: "pepe",
      chainIds: [ListingDepositChainId.BASE],
      marketStatus: ListingMarketStatus.LISTED,
      limit: 50,
      offset: 100,
      sortBy: "tvl",
      orderBy: "asc",
      filters: { tvl: { min: 1n } },
    });

    expect(marketUserSearchV2MarketSearchUserGet).toHaveBeenCalledWith(
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
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
        paramsSerializer: { indexes: null },
      }),
    );
  });

  it("normalizes the response into a UserListingMarketPage", async () => {
    const { config } = mockConfig();
    marketUserSearchV2MarketSearchUserGet.mockResolvedValue({
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
            user_deposit: "5000000000000000000",
            user_share_percentage: 12.5,
            user_revenue: "250000000000000000",
          },
        ],
      },
    });

    const page = await getUserListingMarkets(config, { accessToken: "TOKEN123" });

    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      tokenTicker: "SYMM",
      tvl: 71036417337070986131n,
      marketStatus: ListingMarketStatus.LISTED,
      marketCap: null,
      userDeposit: 5000000000000000000n,
      userSharePercentage: 12.5,
      userRevenue: 250000000000000000n,
    });
  });

  it("throws LISTING_UNSUPPORTED before any request when the solver does not use the listing service", async () => {
    const { config } = mockConfig();

    await expect(
      getUserListingMarkets(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t" }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      getUserListingMarkets(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t" }),
    ).rejects.toMatchObject({ code: "LISTING_UNSUPPORTED" });
    expect(marketUserSearchV2MarketSearchUserGet).not.toHaveBeenCalled();
  });
});
