import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const getClientConfigV2ConfigsGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getClientConfigV2ConfigsGet,
  };
});

import { getListingConfig } from "./get-listing-config";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getListingConfig", () => {
  beforeEach(() => {
    getClientConfigV2ConfigsGet.mockReset();
  });

  it("reads from the enigma listing endpoint and normalizes the response", async () => {
    const { config } = mockConfig();
    getClientConfigV2ConfigsGet.mockResolvedValue({
      data: {
        recommended_initial_deposit_usdc: "500000000000000000000",
        minimum_initial_deposit_usdc: "450000000000000000000",
        listing_fee_usdc: "25000000000000000000",
        supported_deposit_chains: [{ chain_id: ListingDepositChainId.HYPER_EVM, chain_name: "HyperEVM" }],
        rate_limits: { market_config_updates_per_day: 5, profit_claims_per_day: 3 },
        protocol_reward_share_percent: 20,
      },
    });

    const cfg = await getListingConfig(config);

    expect(getClientConfigV2ConfigsGet).toHaveBeenCalledWith({ baseURL: LISTING_URL });
    expect(cfg).toEqual({
      recommendedInitialDepositUsdc: 500000000000000000000n,
      minimumInitialDepositUsdc: 450000000000000000000n,
      listingFeeUsdc: 25000000000000000000n,
      supportedDepositChains: [{ chainId: ListingDepositChainId.HYPER_EVM, chainName: "HyperEVM" }],
      rateLimits: { marketConfigUpdatesPerDay: 5, profitClaimsPerDay: 3 },
      protocolRewardSharePercent: 20,
    });
  });

  it("throws LISTING_UNSUPPORTED before any request when the solver does not use the listing service", async () => {
    const { config } = mockConfig();

    await expect(getListingConfig(config, { chainId: SymmioSupportedChainId.BASE })).rejects.toBeInstanceOf(SymmError);
    await expect(getListingConfig(config, { chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "LISTING_UNSUPPORTED",
    });
    expect(getClientConfigV2ConfigsGet).not.toHaveBeenCalled();
  });
});
