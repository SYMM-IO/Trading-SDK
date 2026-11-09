import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import { toListingConfig } from "./to-listing-config";

/** A representative `/v2/configs` response, trimmed to the fields under test. */
function makeConfig(overrides: Parameters<typeof toListingConfig>[0] = {}) {
  return {
    recommended_deposit_usdc: "500000000000000000000",
    minimum_deposit_usdc: "450000000000000000000",
    listing_fee_usdc: "25000000000000000000",
    max_leverage_bounds: { minimum: 1, maximum: 100 },
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
  it("preserves each chain's USD token address and native decimals", () => {
    const chains = [
      {
        chain_id: 0,
        chain_name: "solana",
        usd_token: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
      },
      {
        chain_id: 56,
        chain_name: "bsc",
        usd_token: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
      },
      {
        chain_id: 4663,
        chain_name: "robinhood",
        usd_token: { address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", decimals: 6 },
      },
      { chain_id: 8453, chain_name: "base", usd_token: { address: "zero-decimal-token", decimals: 0 } },
    ];
    const cfg = toListingConfig({ supported_deposit_chains: chains });

    expect(cfg.supportedDepositChains).toEqual(
      chains.map((chain) => ({ chainId: chain.chain_id, chainName: chain.chain_name, usdToken: chain.usd_token })),
    );
  });

  it("accepts mixed legacy, null and current USD-token metadata", () => {
    const chains = [
      { chain_id: 0, chain_name: "solana" },
      { chain_id: 56, chain_name: "bsc", usd_token: null },
      { chain_id: 4663, chain_name: "robinhood", usd_token: { address: "quote-token", decimals: 6 } },
    ];
    const cfg = toListingConfig({ supported_deposit_chains: chains });

    expect(cfg.supportedDepositChains[0]?.usdToken).toBeUndefined();
    expect(cfg.supportedDepositChains[1]?.usdToken).toBeUndefined();
    expect(cfg.supportedDepositChains[2]?.usdToken).toEqual({ address: "quote-token", decimals: 6 });
  });

  it("preserves the separate legacy universal floor", () => {
    const value = toListingConfig({
      minimum_initial_deposit_usdc: "3750000000000000000",
      minimum_deposit_usdc: "1000000000000000000",
      recommended_initial_deposit_usdc: "5000000000000000000",
    });
    expect(value.minimumDepositUsdc).toBe(3750000000000000000n);
    expect(value.legacyUniversalDepositFloorUsdc).toBe(1000000000000000000n);
    expect(value.recommendedDepositUsdc).toBe(5000000000000000000n);
  });
  it("retains missing values and rejects inverted leverage bounds", () => {
    const value = toListingConfig({ max_leverage_bounds: { minimum: 20, maximum: 5 } });
    expect(value.minimumDepositUsdc).toBeNull();
    expect(value.reportedListingFeeUsdc).toBeNull();
    expect(value.reportedProfitClaimsPerDay).toBeNull();
    expect(value.maxLeverageBounds).toBeNull();
    expect(value.supportedDepositChains).toEqual([]);
  });
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
