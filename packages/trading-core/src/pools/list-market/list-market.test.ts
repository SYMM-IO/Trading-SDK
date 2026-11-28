import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";

const { addMarketV2MarketAddMarketPost, listMarketV2MarketListMarketPost } = vi.hoisted(() => ({
  addMarketV2MarketAddMarketPost: vi.fn(),
  listMarketV2MarketListMarketPost: vi.fn(),
}));

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    addMarketV2MarketAddMarketPost,
    listMarketV2MarketListMarketPost,
  };
});

import { listMarket } from "./list-market";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).listing?.url;

const PARAMETERS = {
  accessToken: "TOKEN123",
  tokenContractAddress: "0xToken",
  buyBackRatio: 50,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.BASE,
} as const;

const RESPONSE = {
  token_contract_address: "0xToken",
  user_address: "0xUser",
  token_name: "Symmio",
  token_ticker: "SYMM",
  buy_back_ratio: 50,
  max_leverage: 20,
  deposit_chain: ListingDepositChainId.BASE,
  wallet_public_key: "0xDepositWallet",
  main_pool: null,
  token_decimal: 18,
  market_status: "waiting_for_deposit",
};

function axiosFailure(status: number, data: unknown): AxiosError {
  return new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: status === 401 ? "Unauthorized" : "Conflict",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  });
}

describe("listMarket", () => {
  beforeEach(() => {
    addMarketV2MarketAddMarketPost.mockReset();
    listMarketV2MarketListMarketPost.mockReset();
  });

  it("posts the request body with the bearer token to the list-market route, never add-market, and normalizes the response", async () => {
    const { config } = mockConfig();
    listMarketV2MarketListMarketPost.mockResolvedValue({ data: RESPONSE });

    const pool = await listMarket(config, { ...PARAMETERS, isTax: false, cexList: ["Binance"] });

    expect(listMarketV2MarketListMarketPost).toHaveBeenCalledWith(
      {
        token_contract_address: "0xToken",
        buy_back_ratio: 50,
        max_leverage: 20,
        deposit_chain: ListingDepositChainId.BASE,
        is_tax: false,
        cex_list: ["Binance"],
      },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
    expect(addMarketV2MarketAddMarketPost).not.toHaveBeenCalled();

    expect(pool).toEqual({
      isTax: null,
      userWhitelistTax: null,
      additionalChains: null,
      cexList: null,
      tokenContractAddress: "0xToken",
      userAddress: "0xUser",
      tokenName: "Symmio",
      tokenTicker: "SYMM",
      tokenDecimal: 18,
      buyBackRatio: 50,
      maxLeverage: 20,
      depositChain: ListingDepositChainId.BASE,
      marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
      walletPublicKey: "0xDepositWallet",
      mainPool: null,
    });
  });

  it("surfaces a rejected listing as LIST_MARKET_FAILED with the service's status and body kept", async () => {
    const { config } = mockConfig();
    const body = { error_code: 20, error_message: "Market already exists" };
    listMarketV2MarketListMarketPost.mockRejectedValue(axiosFailure(409, body));

    const call = listMarket(config, PARAMETERS);

    await expect(call).rejects.toBeInstanceOf(SymmApiError);
    await expect(call).rejects.toMatchObject({
      kind: "api",
      code: "LIST_MARKET_FAILED",
      status: 409,
      responseData: body,
    });
  });

  it("surfaces a bad or expired token as a LIST_MARKET_FAILED 401", async () => {
    const { config } = mockConfig();
    listMarketV2MarketListMarketPost.mockRejectedValue(axiosFailure(401, { error_code: 32 }));

    await expect(listMarket(config, PARAMETERS)).rejects.toMatchObject({
      kind: "api",
      code: "LIST_MARKET_FAILED",
      status: 401,
    });
  });

  it("surfaces a request that gets no response as a LIST_MARKET_FAILED with status 0", async () => {
    const { config } = mockConfig();
    listMarketV2MarketListMarketPost.mockRejectedValue(new AxiosError("Network Error", AxiosError.ERR_NETWORK));

    await expect(listMarket(config, PARAMETERS)).rejects.toMatchObject({
      kind: "api",
      code: "LIST_MARKET_FAILED",
      status: 0,
    });
  });

  it("wraps a non-axios failure as a plain api SymmError", async () => {
    const { config } = mockConfig();
    listMarketV2MarketListMarketPost.mockRejectedValue(new Error("socket hang up"));

    const call = listMarket(config, PARAMETERS);

    await expect(call).rejects.toBeInstanceOf(SymmError);
    await expect(call).rejects.not.toBeInstanceOf(SymmApiError);
    await expect(call).rejects.toMatchObject({ kind: "api", code: "LIST_MARKET_FAILED" });
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(listMarket(config, { ...PARAMETERS, chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      kind: "config",
      code: "LISTING_NOT_CONFIGURED",
    });
    expect(listMarketV2MarketListMarketPost).not.toHaveBeenCalled();
  });
});
