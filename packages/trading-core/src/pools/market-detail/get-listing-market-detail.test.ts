import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import { MarketStatus, type GetMarketResponseSchema } from "../types/generated/listing-backend";

const getMarketV2MarketGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return { ...actual, getMarketV2MarketGet };
});

import { getListingMarketDetail } from "./get-listing-market-detail";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

/** A live SYMM detail row, trimmed to the fields this test reads back. */
function makeRow(overrides: Partial<GetMarketResponseSchema> = {}): GetMarketResponseSchema {
  return {
    token_contract_address: TOKEN,
    token_name: "Symmio",
    token_ticker: "SYMM",
    token_decimal: 18,
    symbol_id: 1,
    deposit_chain: ListingDepositChainId.BASE,
    market_status: MarketStatus.listed,
    max_leverage: 18,
    buyback_ratio: 50,
    listing_time: 1772715579,
    age: 1776084720,
    active_lps: 55,
    tvl: "436590910442466678775861",
    total_usdc_in_pool: "14340638353162345849846",
    total_token_in_pool: "38635451216126673641847703",
    maintenance_fees: "0",
    reward_1h: "0",
    reward_6h: "0",
    reward_24h: "0",
    reward_30d: "0",
    reward_lifetime: "5644635058100607065836",
    solver_revenue_1h: "0",
    solver_revenue_6h: "0",
    solver_revenue_24h: "0",
    solver_revenue_30d: "0",
    solver_revenue_lifetime: "0",
    apy_1h: "0",
    apy_6h: "0",
    apy_24h: "0",
    apy_30d: "4743902388478991319",
    apy_lifetime: "3466957350816584243",
    long_position_amount: "8371837985641000000000000",
    long_position_value: "69084894679122888410802",
    long_position_avg_open_price: "8252058245467028",
    long_position_upnl: "22411664984426494286154.904298000000",
    short_position_amount: "761293150867000000000000",
    short_position_value: "8239603301588694897930",
    short_position_avg_open_price: "10823167517276372",
    short_position_upnl: "-80637046973269407544.810478000000",
    ...overrides,
  } as GetMarketResponseSchema;
}

/** An axios rejection shaped the way the listing backend fails. */
function axiosFailure(): AxiosError {
  return Object.assign(new AxiosError("Request failed with status code 404"), {
    isAxiosError: true,
    config: { url: "/v2/market/", method: "get" },
    response: { status: 404, statusText: "Not Found", data: { detail: "market not found" } },
  }) as AxiosError;
}

describe("getListingMarketDetail", () => {
  beforeEach(() => {
    getMarketV2MarketGet.mockReset();
  });

  it("addresses the pool by token and deposit chain, and returns the mapped detail", async () => {
    const { config } = mockConfig();
    getMarketV2MarketGet.mockResolvedValue({ data: makeRow() });

    const detail = await getListingMarketDetail(config, {
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
    });

    expect(getMarketV2MarketGet).toHaveBeenCalledWith(
      { token_contract_address: TOKEN, deposit_chain: ListingDepositChainId.BASE },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(detail).toMatchObject({
      tokenTicker: "SYMM",
      symbolId: 1,
      depositChain: ListingDepositChainId.BASE,
      marketStatus: ListingMarketStatus.LISTED,
    });
  });

  it("sends no bearer header — the detail read is public", async () => {
    const { config } = mockConfig();
    getMarketV2MarketGet.mockResolvedValue({ data: makeRow() });

    await getListingMarketDetail(config, { tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.BASE });

    const requestConfig = getMarketV2MarketGet.mock.calls[0]![1] as { headers?: Record<string, unknown> };
    expect(requestConfig.headers?.Authorization).toBeUndefined();
  });

  it("keeps the deposit chain distinct, since one token can be listed from several", async () => {
    const { config } = mockConfig();
    getMarketV2MarketGet.mockResolvedValue({ data: makeRow({ deposit_chain: ListingDepositChainId.SOLANA }) });

    await getListingMarketDetail(config, { tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.SOLANA });

    expect(getMarketV2MarketGet).toHaveBeenCalledWith(
      expect.objectContaining({ deposit_chain: ListingDepositChainId.SOLANA }),
      expect.anything(),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    const call = () =>
      getListingMarketDetail(config, {
        chainId: SymmioSupportedChainId.BASE,
        tokenContractAddress: TOKEN,
        depositChain: ListingDepositChainId.BASE,
      });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getMarketV2MarketGet).not.toHaveBeenCalled();
  });

  it("wraps an axios rejection as SymmApiError tagged FETCH_LISTING_MARKET_DETAIL_FAILED", async () => {
    const { config } = mockConfig();
    getMarketV2MarketGet.mockRejectedValue(axiosFailure());

    const error = await getListingMarketDetail(config, {
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_LISTING_MARKET_DETAIL_FAILED",
      status: 404,
      statusText: "Not Found",
      responseData: { detail: "market not found" },
    });
  });

  it("wraps a non-axios rejection as a SymmError of kind `api` carrying the cause", async () => {
    const { config } = mockConfig();
    const cause = new Error("boom");
    getMarketV2MarketGet.mockRejectedValue(cause);

    const error = await getListingMarketDetail(config, {
      tokenContractAddress: TOKEN,
      depositChain: ListingDepositChainId.BASE,
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "api", code: "FETCH_LISTING_MARKET_DETAIL_FAILED", cause });
    expect((error as SymmError).message).toContain("boom");
  });
});
