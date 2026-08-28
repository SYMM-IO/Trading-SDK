import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getUserTotalRewardQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getUserTotalRewardQueryOptions };
});

import { useUserTotalReward } from "./use-user-total-reward";

const USER_ADDRESS = "0x1111111111111111111111111111111111111111";

function mockOptions(queryFn: () => Promise<unknown>) {
  getUserTotalRewardQueryOptions.mockReturnValue({
    queryKey: ["getUserTotalReward", {}],
    enabled: true,
    queryFn,
  });
}

describe("useUserTotalReward", () => {
  afterEach(() => {
    getUserTotalRewardQueryOptions.mockReset();
  });

  it("forwards the token, address and window into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(3200000000000000000n));

    const { result } = renderHookWithProviders(() =>
      useUserTotalReward({ config, accessToken: "tok-abc", userAddress: USER_ADDRESS, days: 30 }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3200000000000000000n);
    expect(getUserTotalRewardQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        accessToken: "tok-abc",
        userAddress: USER_ADDRESS,
        days: 30,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle before sign-in", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(0n);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useUserTotalReward({ config, accessToken: "", userAddress: USER_ADDRESS, days: 30 }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("stays idle while the wallet address is unknown", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(0n);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useUserTotalReward({ config, accessToken: "tok-abc", userAddress: "", days: 30 }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });
});
