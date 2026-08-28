import { ListingDepositChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getPoolTotalRewardQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getPoolTotalRewardQueryOptions };
});

import { usePoolTotalReward } from "./use-pool-total-reward";

const MARKET_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

function mockOptions(queryFn: () => Promise<unknown>) {
  getPoolTotalRewardQueryOptions.mockReturnValue({
    queryKey: ["getPoolTotalReward", {}],
    enabled: true,
    queryFn,
  });
}

describe("usePoolTotalReward", () => {
  afterEach(() => {
    getPoolTotalRewardQueryOptions.mockReset();
  });

  it("forwards the market and window into the core query options and returns the aggregate", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(12400000000000000000n));

    const { result } = renderHookWithProviders(() =>
      usePoolTotalReward({
        config,
        marketAddress: MARKET_ADDRESS,
        marketChainId: ListingDepositChainId.BASE,
        days: 30,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(12400000000000000000n);
    expect(getPoolTotalRewardQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ marketAddress: MARKET_ADDRESS, days: 30, chainId: expect.any(Number) }),
    );
  });

  it("stays idle before a pool is picked", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(0n);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      usePoolTotalReward({ config, marketAddress: "", marketChainId: ListingDepositChainId.BASE, days: 30 }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });
});
