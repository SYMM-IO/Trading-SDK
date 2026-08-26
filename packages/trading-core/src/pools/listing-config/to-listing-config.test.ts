import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import type { ClientConfigResponse } from "../types/generated/listing-backend";
import { toListingConfig } from "./to-listing-config";

/** A representative `/v2/configs` response, trimmed to the fields under test. */
function makeConfig(overrides: Partial<ClientConfigResponse> = {}): ClientConfigResponse {
  return {
    recommended_initial_deposit_usdc: "500000000000000000000",
    minimum_initial_deposit_usdc: "450000000000000000000",
    listing_fee_usdc: "25000000000000000000",
    supported_deposit_chains: [
      { chain_id: ListingDepositChainId.HYPER_EVM, chain_name: "HyperEVM" },
      { chain_id: ListingDepositChainId.BASE, chain_name: "Base" },
    ],
    rate_limits: {
      market_config_updates_per_day: 5,
      profit_claims_per_day: 3,
    },
    protocol_reward_share_percent: 20,
    ...overrides,
  };
}

describe("toListingConfig", () => {
  it("parses the three usdc strings into 18-decimal bigints", () => {
    const cfg = toListingConfig(makeConfig());

    expect(cfg.recommendedInitialDepositUsdc).toBe(500000000000000000000n);
    expect(cfg.minimumInitialDepositUsdc).toBe(450000000000000000000n);
    expect(cfg.listingFeeUsdc).toBe(25000000000000000000n);
  });

  it("maps supported_deposit_chains into ListingDepositChain[]", () => {
    const cfg = toListingConfig(makeConfig());

    expect(cfg.supportedDepositChains).toEqual([
      { chainId: ListingDepositChainId.HYPER_EVM, chainName: "HyperEVM" },
      { chainId: ListingDepositChainId.BASE, chainName: "Base" },
    ]);
    expect(cfg.supportedDepositChains[0]?.chainId).toBe(999);
  });

  it("camelCases the rate limits", () => {
    const cfg = toListingConfig(makeConfig());

    expect(cfg.rateLimits).toEqual({ marketConfigUpdatesPerDay: 5, profitClaimsPerDay: 3 });
  });

  it("copies the protocol reward share percent verbatim", () => {
    expect(toListingConfig(makeConfig()).protocolRewardSharePercent).toBe(20);
    expect(toListingConfig(makeConfig({ protocol_reward_share_percent: 0 })).protocolRewardSharePercent).toBe(0);
  });

  it("guards a malformed usdc string to 0n rather than throwing", () => {
    const cfg = toListingConfig(makeConfig({ listing_fee_usdc: "not-a-number" }));

    expect(cfg.listingFeeUsdc).toBe(0n);
  });
});
