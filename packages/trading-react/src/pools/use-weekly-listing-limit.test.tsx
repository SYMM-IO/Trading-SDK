import type { GetWeeklyListingLimitReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getWeeklyListingLimitQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getWeeklyListingLimitQueryOptions };
});

import { useWeeklyListingLimit } from "./use-weekly-listing-limit";

const LIMIT: GetWeeklyListingLimitReturnType = {
  limit: 3,
  remaining: 2,
  resetAt: 1772715579,
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getWeeklyListingLimitQueryOptions.mockReturnValue({
    queryKey: ["getWeeklyListingLimit", {}],
    enabled: true,
    queryFn,
  });
}

describe("useWeeklyListingLimit", () => {
  afterEach(() => {
    getWeeklyListingLimitQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns the limit", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(LIMIT));

    const { result } = renderHookWithProviders(() => useWeeklyListingLimit({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(LIMIT);
    expect(getWeeklyListingLimitQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });

  it("takes no required parameters", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(LIMIT));

    const { result } = renderHookWithProviders(() => useWeeklyListingLimit({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, forwardedOptions] = getWeeklyListingLimitQueryOptions.mock.lastCall ?? [];
    expect(forwardedOptions?.query).toBeUndefined();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useWeeklyListingLimit({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
