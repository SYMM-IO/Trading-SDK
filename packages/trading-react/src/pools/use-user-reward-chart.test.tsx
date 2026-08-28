import { ListingDepositChainId, type GetUserRewardChartReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getUserRewardChartQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getUserRewardChartQueryOptions };
});

import { useUserRewardChart } from "./use-user-reward-chart";

const CHARTS: GetUserRewardChartReturnType = [
  {
    marketAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
    marketChainId: ListingDepositChainId.BASE,
    rewards: [{ timestamp: 1_752_364_800, reward: 1000000000000000000n }],
  },
];

function mockOptions(queryFn: () => Promise<unknown>) {
  getUserRewardChartQueryOptions.mockReturnValue({
    queryKey: ["getUserRewardChart", {}],
    enabled: true,
    queryFn,
  });
}

describe("useUserRewardChart", () => {
  afterEach(() => {
    getUserRewardChartQueryOptions.mockReset();
  });

  it("forwards the access token into the core query options and returns one series per market", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(CHARTS));

    const { result } = renderHookWithProviders(() => useUserRewardChart({ config, accessToken: "tok-abc" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(CHARTS);
    expect(getUserRewardChartQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accessToken: "tok-abc", chainId: expect.any(Number) }),
    );
  });

  it("stays idle before sign-in", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(CHARTS);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() => useUserRewardChart({ config, accessToken: "" }));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useUserRewardChart({ config, accessToken: "tok-abc" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
