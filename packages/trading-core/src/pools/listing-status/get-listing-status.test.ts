import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId, ListingMarketStatus } from "../types";

const getMarketListingStatusV2MarketListingStatusGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getMarketListingStatusV2MarketListingStatusGet,
  };
});

import { getListingStatus } from "./get-listing-status";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const TOKEN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("getListingStatus", () => {
  beforeEach(() => {
    getMarketListingStatusV2MarketListingStatusGet.mockReset();
  });

  it("passes the token address and deposit chain as query params to the enigma listing endpoint and normalizes the response", async () => {
    const { config } = mockConfig();
    getMarketListingStatusV2MarketListingStatusGet.mockResolvedValue({
      data: {
        current_step: "deposit",
        steps: ["deposit", "review", "listed"],
        market_status: "under_review",
        error_code: null,
        error_detail: null,
        retry_count: 1,
        retry_limit: 3,
      },
    });

    const status = await getListingStatus(config, {
      tokenContractAddress: TOKEN_ADDRESS,
      depositChain: ListingDepositChainId.HYPER_EVM,
    });

    expect(getMarketListingStatusV2MarketListingStatusGet).toHaveBeenCalledWith(
      { token_contract_address: TOKEN_ADDRESS, deposit_chain: ListingDepositChainId.HYPER_EVM },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );

    expect(status).toEqual({
      marketStatus: ListingMarketStatus.UNDER_REVIEW,
      currentStep: "deposit",
      steps: ["deposit", "review", "listed"],
      errorCode: null,
      errorDetail: null,
      retryCount: 1,
      retryLimit: 3,
    });
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getListingStatus(config, {
        chainId: SymmioSupportedChainId.BASE,
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      getListingStatus(config, {
        chainId: SymmioSupportedChainId.BASE,
        tokenContractAddress: TOKEN_ADDRESS,
        depositChain: ListingDepositChainId.HYPER_EVM,
      }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getMarketListingStatusV2MarketListingStatusGet).not.toHaveBeenCalled();
  });
});
