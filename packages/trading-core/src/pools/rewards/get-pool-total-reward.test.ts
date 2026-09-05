import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const getMarketTotalRewardV2MarketTotalRewardGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getMarketTotalRewardV2MarketTotalRewardGet,
  };
});

import { getPoolTotalReward } from "./get-pool-total-reward";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;
const MARKET_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("getPoolTotalReward", () => {
  beforeEach(() => {
    getMarketTotalRewardV2MarketTotalRewardGet.mockReset();
  });

  it("forwards the window in days and descales the aggregate", async () => {
    const { config } = mockConfig();
    getMarketTotalRewardV2MarketTotalRewardGet.mockResolvedValue({ data: { total_reward: "12400000000000000000" } });

    const total = await getPoolTotalReward(config, {
      marketAddress: MARKET_ADDRESS,
      marketChainId: ListingDepositChainId.BASE,
      days: 30,
    });

    expect(getMarketTotalRewardV2MarketTotalRewardGet).toHaveBeenCalledWith(
      { market_address: MARKET_ADDRESS, chain_id: ListingDepositChainId.BASE, days: 30 },
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(total).toBe(12400000000000000000n);
  });

  it("reads an absent aggregate as zero earned, not as unknown", async () => {
    const { config } = mockConfig();
    getMarketTotalRewardV2MarketTotalRewardGet.mockResolvedValue({ data: { total_reward: "" } });

    await expect(
      getPoolTotalReward(config, {
        marketAddress: MARKET_ADDRESS,
        marketChainId: ListingDepositChainId.BASE,
        days: 7,
      }),
    ).resolves.toBe(0n);
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();
    const call = () =>
      getPoolTotalReward(config, {
        chainId: SymmioSupportedChainId.BASE,
        marketAddress: MARKET_ADDRESS,
        marketChainId: ListingDepositChainId.BASE,
        days: 30,
      });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getMarketTotalRewardV2MarketTotalRewardGet).not.toHaveBeenCalled();
  });
});
