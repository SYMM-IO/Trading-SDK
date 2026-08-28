import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const getDepositAddressV2MarketDepositAddressPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getDepositAddressV2MarketDepositAddressPost,
  };
});

import { getDepositAddress } from "./get-deposit-address";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const TOKEN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("getDepositAddress", () => {
  beforeEach(() => {
    getDepositAddressV2MarketDepositAddressPost.mockReset();
  });

  it("POSTs the market body, targets the enigma listing endpoint with the bearer token, and normalizes the response", async () => {
    const { config } = mockConfig();
    getDepositAddressV2MarketDepositAddressPost.mockResolvedValue({
      data: {
        token_contract_address: TOKEN_ADDRESS,
        user_address: "0xUser",
        deposit_chain: ListingDepositChainId.HYPER_EVM,
        wallet_public_key: "0xDepositWallet",
        token_decimal: 18,
        market_status: "listed",
      },
    });

    const deposit = await getDepositAddress(config, {
      accessToken: "TOKEN123",
      tokenContractAddress: TOKEN_ADDRESS,
      depositChain: ListingDepositChainId.HYPER_EVM,
    });

    expect(getDepositAddressV2MarketDepositAddressPost).toHaveBeenCalledWith(
      { token_contract_address: TOKEN_ADDRESS, deposit_chain: ListingDepositChainId.HYPER_EVM },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );

    expect(deposit).toEqual({
      tokenContractAddress: TOKEN_ADDRESS,
      userAddress: "0xUser",
      depositChain: ListingDepositChainId.HYPER_EVM,
      depositAddress: "0xDepositWallet",
      tokenDecimal: 18,
      marketStatus: "listed",
    });
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getDepositAddress(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      getDepositAddress(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getDepositAddressV2MarketDepositAddressPost).not.toHaveBeenCalled();
  });
});
