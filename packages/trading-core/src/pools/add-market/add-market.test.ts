import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";

const addMarketV2MarketAddMarketPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    addMarketV2MarketAddMarketPost,
  };
});

import { addMarket } from "./add-market";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("addMarket", () => {
  beforeEach(() => {
    addMarketV2MarketAddMarketPost.mockReset();
  });

  it("posts the request body with the bearer token to the enigma listing endpoint and normalizes the response", async () => {
    const { config } = mockConfig();
    addMarketV2MarketAddMarketPost.mockResolvedValue({
      data: {
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
      },
    });

    const pool = await addMarket(config, {
      accessToken: "TOKEN123",
      tokenContractAddress: "0xToken",
      buyBackRatio: 50,
      maxLeverage: 20,
      depositChain: ListingDepositChainId.BASE,
      isTax: false,
    });

    expect(addMarketV2MarketAddMarketPost).toHaveBeenCalledWith(
      {
        token_contract_address: "0xToken",
        buy_back_ratio: 50,
        max_leverage: 20,
        deposit_chain: ListingDepositChainId.BASE,
        is_tax: false,
      },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );

    expect(pool).toEqual({
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

  it("throws LISTING_UNSUPPORTED before any request when the solver does not use the listing service", async () => {
    const { config } = mockConfig();

    await expect(
      addMarket(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        tokenContractAddress: "0xToken",
        buyBackRatio: 50,
        maxLeverage: 20,
        depositChain: ListingDepositChainId.BASE,
      }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      addMarket(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        tokenContractAddress: "0xToken",
        buyBackRatio: 50,
        maxLeverage: 20,
        depositChain: ListingDepositChainId.BASE,
      }),
    ).rejects.toMatchObject({ code: "LISTING_UNSUPPORTED" });
    expect(addMarketV2MarketAddMarketPost).not.toHaveBeenCalled();
  });
});
