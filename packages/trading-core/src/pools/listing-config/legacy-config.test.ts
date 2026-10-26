import { describe, expect, it } from "vitest";
import { toListingConfig } from "./to-listing-config";
describe("legacy config compatibility", () => {
  it("uses initial deposit fields and keeps absent limits unknown", () => {
    const config = toListingConfig({
      minimum_initial_deposit_usdc: "3750000000000000000",
      recommended_initial_deposit_usdc: "5000000000000000000",
      minimum_deposit_usdc: "1000000000000000000",
    });
    expect(config.minimumInitialDepositUsdc).toBe(3750000000000000000n);
    expect(config.minimumDepositUsdc).toBe(config.minimumInitialDepositUsdc);
    expect(config.recommendedInitialDepositUsdc).toBe(5000000000000000000n);
    expect(config.recommendedDepositUsdc).toBe(config.recommendedInitialDepositUsdc);
    expect(config.legacyUniversalDepositFloorUsdc).toBe(1000000000000000000n);
    expect(config.rateLimits).toEqual({ marketConfigUpdatesPerDay: null, profitClaimsPerDay: null });
  });
});
