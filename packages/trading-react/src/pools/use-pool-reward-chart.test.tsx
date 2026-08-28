import { ListingDepositChainId, type GetPoolRewardChartReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getPoolRewardChartQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getPoolRewardChartQueryOptions };
});

import { usePoolRewardChart } from "./use-pool-reward-chart";

const REWARDS: GetPoolRewardChartReturnType = [
  { timestamp: 1_752_364_800, reward: 5500000000000000n },
  { timestamp: 1_752_451_200, reward: 0n },
];

const MARKET_ADDRESS = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

function mockOptions(queryFn: () => Promise<unknown>) {
  getPoolRewardChartQueryOptions.mockReturnValue({
    queryKey: ["getPoolRewardChart", {}],
    enabled: true,
    queryFn,
  });
}

describe("usePoolRewardChart", () => {
  afterEach(() => {
    getPoolRewardChartQueryOptions.mockReset();
  });

  it("forwards the market's address and its own chain id into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(REWARDS));

    const { result } = renderHookWithProviders(() =>
      usePoolRewardChart({ config, marketAddress: MARKET_ADDRESS, marketChainId: ListingDepositChainId.BASE }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(REWARDS);
    expect(getPoolRewardChartQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        marketAddress: MARKET_ADDRESS,
        marketChainId: ListingDepositChainId.BASE,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle before a pool is picked", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(REWARDS);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      usePoolRewardChart({ config, marketAddress: "", marketChainId: ListingDepositChainId.BASE }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() =>
      usePoolRewardChart({ config, marketAddress: MARKET_ADDRESS, marketChainId: ListingDepositChainId.BASE }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
