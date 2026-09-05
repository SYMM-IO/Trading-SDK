import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const updateMarketConfigV2MarketConfigPost = vi.hoisted(() => vi.fn());
const getDepositAddressV2MarketDepositAddressPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    updateMarketConfigV2MarketConfigPost,
    getDepositAddressV2MarketDepositAddressPost,
  };
});

import { updateListingMarketConfig } from "./update-listing-market-config";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

const PARAMETERS = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  depositChain: ListingDepositChainId.HYPER_EVM,
  maxLeverage: 20,
  buybackRatio: 50,
} as const;

const RESPONSE = {
  data: {
    token_contract_address: PARAMETERS.tokenContractAddress,
    deposit_chain: ListingDepositChainId.HYPER_EVM,
    user_max_leverage: 20,
    user_buyback_ratio: 50,
    max_leverage: 18,
    buyback_ratio: 52,
  },
};

const DEPOSIT_ADDRESS_RESPONSE = {
  data: {
    token_contract_address: PARAMETERS.tokenContractAddress,
    user_address: "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A",
    deposit_chain: ListingDepositChainId.HYPER_EVM,
    wallet_public_key: "0xWallet",
    token_decimal: 18,
    market_status: "listed",
  },
};

describe("updateListingMarketConfig", () => {
  beforeEach(() => {
    updateMarketConfigV2MarketConfigPost.mockReset();
    getDepositAddressV2MarketDepositAddressPost.mockReset();
    getDepositAddressV2MarketDepositAddressPost.mockResolvedValue(DEPOSIT_ADDRESS_RESPONSE);
  });

  it("mints the caller's deposit address before submitting, then returns the re-blended pool config", async () => {
    const { config } = mockConfig();
    updateMarketConfigV2MarketConfigPost.mockResolvedValue(RESPONSE);

    const updated = await updateListingMarketConfig(config, PARAMETERS);

    expect(getDepositAddressV2MarketDepositAddressPost).toHaveBeenCalledOnce();
    expect(updateMarketConfigV2MarketConfigPost).toHaveBeenCalledWith(
      {
        token_contract_address: PARAMETERS.tokenContractAddress,
        deposit_chain: ListingDepositChainId.HYPER_EVM,
        max_leverage: 20,
        buyback_ratio: 50,
      },
      {
        baseURL: LISTING_URL,
        headers: { Authorization: `Bearer ${PARAMETERS.accessToken}` },
      },
    );
    expect(updated).toEqual({
      tokenContractAddress: PARAMETERS.tokenContractAddress,
      depositChain: ListingDepositChainId.HYPER_EVM,
      userMaxLeverage: 20,
      userBuybackRatio: 50,
      maxLeverage: 18,
      buybackRatio: 52,
    });
  });

  it("skips the deposit-address round trip when ensureDepositAddress is false", async () => {
    const { config } = mockConfig();
    updateMarketConfigV2MarketConfigPost.mockResolvedValue(RESPONSE);

    await updateListingMarketConfig(config, { ...PARAMETERS, ensureDepositAddress: false });

    expect(getDepositAddressV2MarketDepositAddressPost).not.toHaveBeenCalled();
    expect(updateMarketConfigV2MarketConfigPost).toHaveBeenCalledOnce();
  });

  it("rejects with MISSING_MARKET_CONFIG_VALUES when neither knob is supplied", async () => {
    const { config } = mockConfig();

    await expect(
      updateListingMarketConfig(config, {
        accessToken: PARAMETERS.accessToken,
        tokenContractAddress: PARAMETERS.tokenContractAddress,
        depositChain: PARAMETERS.depositChain,
      }),
    ).rejects.toMatchObject({ code: "MISSING_MARKET_CONFIG_VALUES" });
    expect(getDepositAddressV2MarketDepositAddressPost).not.toHaveBeenCalled();
    expect(updateMarketConfigV2MarketConfigPost).not.toHaveBeenCalled();
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      updateListingMarketConfig(config, { ...PARAMETERS, chainId: SymmioSupportedChainId.BASE }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(updateMarketConfigV2MarketConfigPost).not.toHaveBeenCalled();
  });

  it("surfaces a deposit-address failure unchanged rather than relabelling it", async () => {
    const { config } = mockConfig();
    getDepositAddressV2MarketDepositAddressPost.mockRejectedValue(new Error("no wallet"));

    await expect(updateListingMarketConfig(config, PARAMETERS)).rejects.toMatchObject({
      code: "FETCH_DEPOSIT_ADDRESS_FAILED",
    });
    expect(updateMarketConfigV2MarketConfigPost).not.toHaveBeenCalled();
  });

  it("wraps a non-axios failure as UPDATE_LISTING_MARKET_CONFIG_FAILED", async () => {
    const { config } = mockConfig();
    updateMarketConfigV2MarketConfigPost.mockRejectedValue(new Error("boom"));

    await expect(updateListingMarketConfig(config, PARAMETERS)).rejects.toBeInstanceOf(SymmError);
    await expect(updateListingMarketConfig(config, PARAMETERS)).rejects.toMatchObject({
      code: "UPDATE_LISTING_MARKET_CONFIG_FAILED",
    });
  });
});
