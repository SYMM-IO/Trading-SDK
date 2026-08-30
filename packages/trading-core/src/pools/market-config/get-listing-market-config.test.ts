import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const getMarketConfigV2MarketConfigGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getMarketConfigV2MarketConfigGet,
  };
});

import { getListingMarketConfig } from "./get-listing-market-config";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

const PARAMETERS = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("getListingMarketConfig", () => {
  beforeEach(() => {
    getMarketConfigV2MarketConfigGet.mockReset();
  });

  it("reads the market with the bearer token and normalizes the response", async () => {
    const { config } = mockConfig();
    getMarketConfigV2MarketConfigGet.mockResolvedValue({
      data: {
        token_contract_address: PARAMETERS.tokenContractAddress,
        deposit_chain: ListingDepositChainId.HYPER_EVM,
        user_max_leverage: 10,
        user_buyback_ratio: 75,
        max_leverage: 20,
        buyback_ratio: 50,
      },
    });

    const marketConfig = await getListingMarketConfig(config, PARAMETERS);

    expect(getMarketConfigV2MarketConfigGet).toHaveBeenCalledWith(
      {
        token_contract_address: PARAMETERS.tokenContractAddress,
        deposit_chain: ListingDepositChainId.HYPER_EVM,
      },
      {
        baseURL: LISTING_URL,
        headers: { Authorization: `Bearer ${PARAMETERS.accessToken}` },
      },
    );
    expect(marketConfig).toEqual({
      tokenContractAddress: PARAMETERS.tokenContractAddress,
      depositChain: ListingDepositChainId.HYPER_EVM,
      userMaxLeverage: 10,
      userBuybackRatio: 75,
      maxLeverage: 20,
      buybackRatio: 50,
    });
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getListingMarketConfig(config, { ...PARAMETERS, chainId: SymmioSupportedChainId.BASE }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getMarketConfigV2MarketConfigGet).not.toHaveBeenCalled();
  });

  it("wraps a non-axios failure as FETCH_LISTING_MARKET_CONFIG_FAILED", async () => {
    const { config } = mockConfig();
    getMarketConfigV2MarketConfigGet.mockRejectedValue(new Error("boom"));

    await expect(getListingMarketConfig(config, PARAMETERS)).rejects.toBeInstanceOf(SymmError);
    await expect(getListingMarketConfig(config, PARAMETERS)).rejects.toMatchObject({
      code: "FETCH_LISTING_MARKET_CONFIG_FAILED",
    });
  });
});
