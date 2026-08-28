import { describe, expect, it } from "vitest";
import type { LPTokenProfitSchema } from "../types/generated/listing-backend";
import { toUserPoolProfit } from "./to-user-pool-profit";

describe("toUserPoolProfit", () => {
  it("maps every 18-decimal string field to its bigint counterpart", () => {
    const raw: LPTokenProfitSchema = {
      user_balance_in_tokens: "1000000000000000000",
      user_balance_in_usdc: "2500000000000000000",
      claimable_reward: "300000000000000000",
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
