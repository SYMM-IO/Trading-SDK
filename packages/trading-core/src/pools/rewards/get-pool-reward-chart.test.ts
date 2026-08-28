import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const getMarketRewardChartV2MarketChartRewardsGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getMarketRewardChartV2MarketChartRewardsGet,
  };
});

import { getPoolRewardChart } from "./get-pool-reward-chart";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const MARKET_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("getPoolRewardChart", () => {
  beforeEach(() => {
    getMarketRewardChartV2MarketChartRewardsGet.mockReset();
  });

  it("sends the market address and its own chain id as query params and normalizes every point", async () => {
    const { config } = mockConfig();
    getMarketRewardChartV2MarketChartRewardsGet.mockResolvedValue({
      data: [
        { timestamp: 1_752_364_800, reward: "5500000000000000" },
        { timestamp: 1_752_451_200, reward: null },
      ],
    });

    const points = await getPoolRewardChart(config, {
      marketAddress: MARKET_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
    });

    expect(getMarketRewardChartV2MarketChartRewardsGet).toHaveBeenCalledWith(
      { market_address: MARKET_ADDRESS, chain_id: ListingDepositChainId.BASE },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(points).toEqual([
      { timestamp: 1_752_364_800, reward: 5500000000000000n },
      { timestamp: 1_752_451_200, reward: 0n },
    ]);
  });

  it("sends no Authorization header — the endpoint is public", async () => {
    const { config } = mockConfig();
    getMarketRewardChartV2MarketChartRewardsGet.mockResolvedValue({ data: [] });

    await getPoolRewardChart(config, {
      marketAddress: MARKET_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
    });

    expect(getMarketRewardChartV2MarketChartRewardsGet.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();
    const call = () =>
      getPoolRewardChart(config, {
        chainId: SymmioSupportedChainId.BASE,
        marketAddress: MARKET_ADDRESS,
        marketChainId: ListingDepositChainId.BASE,
      });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getMarketRewardChartV2MarketChartRewardsGet).not.toHaveBeenCalled();
  });
});
