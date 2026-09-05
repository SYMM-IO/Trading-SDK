import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const userRetryInfoV2MarketRetryListingInfoGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    userRetryInfoV2MarketRetryListingInfoGet,
  };
});

import { getRetryListingInfo } from "./get-retry-listing-info";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

const REQUIRED = {
  accessToken: "TOKEN123",
  tokenContractAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
} as const;

describe("getRetryListingInfo", () => {
  beforeEach(() => {
    userRetryInfoV2MarketRetryListingInfoGet.mockReset();
  });

  it("requests with the bearer token and market params, and normalizes the response", async () => {
    const { config } = mockConfig();
    userRetryInfoV2MarketRetryListingInfoGet.mockResolvedValue({
      data: { retry_limit: 3, remaining_retries: 2, remaining_cooldown_seconds: 120 },
    });

    await expect(getRetryListingInfo(config, { ...REQUIRED })).resolves.toEqual({
      retryLimit: 3,
      remainingRetries: 2,
      remainingCooldownSeconds: 120,
    });

    expect(userRetryInfoV2MarketRetryListingInfoGet).toHaveBeenCalledWith(
      { token_contract_address: "0xToken", deposit_chain: ListingDepositChainId.HYPER_EVM },
      expect.objectContaining({ baseURL: LISTING_URL, headers: { Authorization: "Bearer TOKEN123" } }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getRetryListingInfo(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    await expect(
      getRetryListingInfo(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE }),
    ).rejects.toBeInstanceOf(SymmError);
    expect(userRetryInfoV2MarketRetryListingInfoGet).not.toHaveBeenCalled();
  });
});
