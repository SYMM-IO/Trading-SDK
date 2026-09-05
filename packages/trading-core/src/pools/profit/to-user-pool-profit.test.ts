import { describe, expect, it } from "vitest";
import type { LPTokenProfitSchema } from "../types/generated/listing-backend";
import { toUserPoolProfit } from "./to-user-pool-profit";

describe("toUserPoolProfit", () => {
  it("maps every 18-decimal string field to its bigint counterpart", () => {
    const raw: LPTokenProfitSchema = {
      user_balance_in_tokens: "1000000000000000000",
      user_balance_in_usdc: "2500000000000000000",
      // claimable_reward is reported in PLAIN decimal units, not 1e18-scaled,
      // so "0.3" (dollars) scales up to 300000000000000000n — unlike its siblings.
      claimable_reward: "0.3",
      claimed_reward: "400000000000000000",
      user_deposited_token_amount: "5000000000000000000",
      user_lp_amount: "6000000000000000000",
      pending_withdraw_lp_amount: "700000000000000000",
    };

    expect(toUserPoolProfit(raw)).toEqual({
      userBalanceInTokens: 1000000000000000000n,
      userBalanceInUsdc: 2500000000000000000n,
      claimableReward: 300000000000000000n,
      claimedReward: 400000000000000000n,
      userDepositedTokenAmount: 5000000000000000000n,
      userLpAmount: 6000000000000000000n,
      pendingWithdrawLpAmount: 700000000000000000n,
      availableLpAmount: 5300000000000000000n,
    });
  });

  it("scales the plain-decimal claimable_reward while reading its 1e18 siblings as-is", () => {
    // Real /v2/profit body: claimable_reward is a plain decimal ("0.0377…"),
    // its siblings are 1e18-scaled integers. Running claimable_reward through
    // toListingValue would truncate it to 0n — the bug this guards against.
    const raw: LPTokenProfitSchema = {
      user_balance_in_tokens: "487586524151501703384",
      user_balance_in_usdc: "217083643885732821",
      claimable_reward: "0.037699391270769714",
      claimed_reward: "54809860294669296",
      user_deposited_token_amount: "0",
      user_lp_amount: "43279622898910400053",
      pending_withdraw_lp_amount: "0",
    };

    const profit = toUserPoolProfit(raw);

    expect(profit.claimableReward).toBe(37699391270769714n);
    expect(profit.claimedReward).toBe(54809860294669296n);
    expect(profit.userBalanceInUsdc).toBe(217083643885732821n);
  });

  it("defaults absent or empty values to 0n", () => {
    const raw = {
      user_balance_in_tokens: "",
      user_balance_in_usdc: "2500000000000000000",
      claimable_reward: "",
      claimed_reward: "",
      user_deposited_token_amount: "",
      user_lp_amount: "6000000000000000000",
      pending_withdraw_lp_amount: "",
    } as unknown as LPTokenProfitSchema;

    expect(toUserPoolProfit(raw)).toEqual({
      userBalanceInTokens: 0n,
      userBalanceInUsdc: 2500000000000000000n,
      claimableReward: 0n,
      claimedReward: 0n,
      userDepositedTokenAmount: 0n,
      userLpAmount: 6000000000000000000n,
      pendingWithdrawLpAmount: 0n,
      availableLpAmount: 6000000000000000000n,
    });
  });

  it("floors availableLpAmount at 0n when the pending amount meets or exceeds the balance", () => {
    const raw = {
      user_balance_in_tokens: "1000000000000000000",
      user_balance_in_usdc: "1000000000000000000",
      claimable_reward: "0",
      claimed_reward: "0",
      user_deposited_token_amount: "1000000000000000000",
      user_lp_amount: "1000000000000000000",
      pending_withdraw_lp_amount: "1000000000000000000",
    } satisfies LPTokenProfitSchema;

    expect(toUserPoolProfit(raw).availableLpAmount).toBe(0n);
  });
});
