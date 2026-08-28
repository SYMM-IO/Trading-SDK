import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";

const getUserTotalRewardV2ProfitTotalRewardGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getUserTotalRewardV2ProfitTotalRewardGet,
  };
});

import { getUserTotalReward } from "./get-user-total-reward";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getUserTotalReward", () => {
  beforeEach(() => {
    getUserTotalRewardV2ProfitTotalRewardGet.mockReset();
  });

  it("sends the user address and window as query params alongside the bearer token", async () => {
    const { config } = mockConfig();
    getUserTotalRewardV2ProfitTotalRewardGet.mockResolvedValue({ data: { total_reward: "3200000000000000000" } });

    const total = await getUserTotalReward(config, {
      accessToken: "TOKEN123",
      userAddress: TEST_USER,
      days: 30,
    });

    expect(getUserTotalRewardV2ProfitTotalRewardGet).toHaveBeenCalledWith(
      { user_address: TEST_USER, days: 30 },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
    expect(total).toBe(3200000000000000000n);
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();
    const call = () =>
      getUserTotalReward(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        userAddress: TEST_USER,
        days: 30,
      });

    await expect(call()).rejects.toBeInstanceOf(SymmError);
    await expect(call()).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(getUserTotalRewardV2ProfitTotalRewardGet).not.toHaveBeenCalled();
  });
});
