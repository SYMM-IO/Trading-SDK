import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const retryListingV2MarketRetryListingPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    retryListingV2MarketRetryListingPost,
  };
});

import { retryListing } from "./retry-listing";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

const REQUIRED = {
  accessToken: "TOKEN123",
  tokenContractAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("retryListing", () => {
  beforeEach(() => {
    retryListingV2MarketRetryListingPost.mockReset();
  });

  it("posts the mapped body with the bearer token and returns the retry allowance", async () => {
    const { config } = mockConfig();
    retryListingV2MarketRetryListingPost.mockResolvedValue({
      data: { retry_limit: 3, remaining_retries: 1, cooldown_seconds: 3600 },
    });

    await expect(retryListing(config, { ...REQUIRED })).resolves.toEqual({
      retryLimit: 3,
      remainingRetries: 1,
      cooldownSeconds: 3600,
    });

    expect(retryListingV2MarketRetryListingPost).toHaveBeenCalledWith(
      { token_contract_address: "0xToken", deposit_chain: ListingDepositChainId.HYPER_EVM },
      expect.objectContaining({ baseURL: LISTING_URL, headers: { Authorization: "Bearer TOKEN123" } }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(retryListing(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "LISTING_NOT_CONFIGURED",
    });
    await expect(retryListing(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE })).rejects.toBeInstanceOf(
      SymmError,
    );
    expect(retryListingV2MarketRetryListingPost).not.toHaveBeenCalled();
  });
});
