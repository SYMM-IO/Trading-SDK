import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import { MarketStatus } from "../types/generated/listing-backend";

const marketSearchV2MarketSearchGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return { ...actual, marketSearchV2MarketSearchGet };
});

import { getListingMarkets } from "./get-listing-markets";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

const PAGE = {
  total: 271,
  limit: 20,
  offset: 0,
  items: [
    {
      contract_address: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
      chain_id: ListingDepositChainId.BASE,
      symbol_id: 1,
      token_ticker: "SYMM",
      token_name: "Symmio",
      max_leverage: 18,
      market_status: MarketStatus.listed,
      listing_time: 1772715579,
    },
  ],
};

/** An axios rejection shaped the way the listing backend fails. */
function axiosFailure(): AxiosError {
  return Object.assign(new AxiosError("Request failed with status code 500"), {
    isAxiosError: true,
    config: { url: "/v2/market/search", method: "get" },
    response: { status: 500, statusText: "Internal Server Error", data: { detail: "search exploded" } },
  }) as AxiosError;
}

describe("getListingMarkets", () => {
  beforeEach(() => {
    marketSearchV2MarketSearchGet.mockReset();
  });

  it("asks for the service's default page when no filters are passed", async () => {
    const { config } = mockConfig();
    marketSearchV2MarketSearchGet.mockResolvedValue({ data: PAGE });

    const page = await getListingMarkets(config);

    expect(marketSearchV2MarketSearchGet).toHaveBeenCalledTimes(1);
    expect(page).toMatchObject({ total: 271, limit: 20, offset: 0 });
    expect(page.items[0]).toMatchObject({ tokenTicker: "SYMM", marketStatus: ListingMarketStatus.LISTED });
  });

  it("serializes array params as repeated keys, since the bracket form is silently ignored", async () => {
    const { config } = mockConfig();
    marketSearchV2MarketSearchGet.mockResolvedValue({ data: PAGE });

    await getListingMarkets(config, { chainIds: [ListingDepositChainId.BASE, ListingDepositChainId.SOLANA] });

    const requestConfig = marketSearchV2MarketSearchGet.mock.calls[0]![1] as {
      baseURL: string;
      paramsSerializer: { indexes: null };
    };
    expect(requestConfig.baseURL).toBe(LISTING_URL);
    expect(requestConfig.paramsSerializer).toEqual({ indexes: null });
  });

  it("maps `search` onto the service's `query` param, which the options bag already owns", async () => {
    const { config } = mockConfig();
    marketSearchV2MarketSearchGet.mockResolvedValue({ data: PAGE });

    await getListingMarkets(config, { search: "pepe", limit: 25, offset: 50 });

    const params = marketSearchV2MarketSearchGet.mock.calls[0]![0] as Record<string, unknown>;
    expect(params).toMatchObject({ query: "pepe", limit: 25, offset: 50 });
    expect(params).not.toHaveProperty("search");
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    const call = () => getListingMarkets(config, { chainId: SymmioSupportedChainId.BASE });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(marketSearchV2MarketSearchGet).not.toHaveBeenCalled();
  });

  it("wraps an axios rejection as SymmApiError tagged FETCH_LISTING_MARKETS_FAILED", async () => {
    const { config } = mockConfig();
    marketSearchV2MarketSearchGet.mockRejectedValue(axiosFailure());

    const error = await getListingMarkets(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({ kind: "api", code: "FETCH_LISTING_MARKETS_FAILED", status: 500 });
  });

  it("wraps a non-axios rejection as a SymmError of kind `api` carrying the cause", async () => {
    const { config } = mockConfig();
    const cause = new Error("boom");
    marketSearchV2MarketSearchGet.mockRejectedValue(cause);

    const error = await getListingMarkets(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "api", code: "FETCH_LISTING_MARKETS_FAILED", cause });
  });
});
