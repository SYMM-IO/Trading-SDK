import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const getUserRewardChartV2ProfitChartRewardsGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getUserRewardChartV2ProfitChartRewardsGet,
  };
});

import { getUserRewardChart } from "./get-user-reward-chart";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getUserRewardChart", () => {
  beforeEach(() => {
    getUserRewardChartV2ProfitChartRewardsGet.mockReset();
  });

  it("sends the bearer token and returns one normalized series per market", async () => {
    const { config } = mockConfig();
    getUserRewardChartV2ProfitChartRewardsGet.mockResolvedValue({
      data: [
        {
          market_address: "0xaaa",
          chain_id: ListingDepositChainId.BASE,
          rewards: [{ timestamp: 1, reward: "1000000000000000000" }],
        },
        { market_address: "0xbbb", chain_id: ListingDepositChainId.SOLANA, rewards: [] },
      ],
    });

    const charts = await getUserRewardChart(config, { accessToken: "TOKEN123" });

    expect(getUserRewardChartV2ProfitChartRewardsGet).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
    expect(charts).toEqual([
      {
        marketAddress: "0xaaa",
        marketChainId: ListingDepositChainId.BASE,
        rewards: [{ timestamp: 1, reward: 1000000000000000000n }],
      },
      { marketAddress: "0xbbb", marketChainId: ListingDepositChainId.SOLANA, rewards: [] },
    ]);
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();
    const call = () => getUserRewardChart(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t" });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getUserRewardChartV2ProfitChartRewardsGet).not.toHaveBeenCalled();
  });
});
