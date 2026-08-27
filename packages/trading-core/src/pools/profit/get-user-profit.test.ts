import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";

const getProfitByTokenV2ProfitTokenContractAddressGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getProfitByTokenV2ProfitTokenContractAddressGet,
  };
});

import { getUserProfit } from "./get-user-profit";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const TOKEN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("getUserProfit", () => {
  beforeEach(() => {
    getProfitByTokenV2ProfitTokenContractAddressGet.mockReset();
  });

  it("passes the token address first, targets the enigma listing endpoint with the bearer token, and normalizes the response", async () => {
    const { config } = mockConfig();
    getProfitByTokenV2ProfitTokenContractAddressGet.mockResolvedValue({
      data: {
        user_balance_in_tokens: "1000000000000000000",
        user_balance_in_usdc: "2500000000000000000",
        claimable_reward: "300000000000000000",
        claimed_reward: "400000000000000000",
        user_deposited_token_amount: "5000000000000000000",
        user_lp_amount: "6000000000000000000",
        pending_withdraw_lp_amount: "700000000000000000",
      },
    });

    const profit = await getUserProfit(config, { accessToken: "TOKEN123", tokenContractAddress: TOKEN_ADDRESS });

    expect(getProfitByTokenV2ProfitTokenContractAddressGet).toHaveBeenCalledWith(
      TOKEN_ADDRESS,
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );

    expect(profit).toEqual({
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

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getUserProfit(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        tokenContractAddress: TOKEN_ADDRESS,
      }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      getUserProfit(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        tokenContractAddress: TOKEN_ADDRESS,
      }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getProfitByTokenV2ProfitTokenContractAddressGet).not.toHaveBeenCalled();
  });
});
