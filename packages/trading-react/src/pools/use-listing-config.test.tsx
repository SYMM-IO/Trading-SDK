import { ListingDepositChainId, type GetListingConfigReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getListingConfigQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getListingConfigQueryOptions };
});

import { useListingConfig } from "./use-listing-config";

const CONFIG: GetListingConfigReturnType = {
  recommendedInitialDepositUsdc: 5000000000000000000000n,
  minimumInitialDepositUsdc: 1000000000000000000000n,
  listingFeeUsdc: 100000000000000000000n,
  supportedDepositChains: [{ chainId: ListingDepositChainId.HYPER_EVM, chainName: "HyperEVM" }],
  rateLimits: { marketConfigUpdatesPerDay: 5, profitClaimsPerDay: 3 },
  protocolRewardSharePercent: 10,
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getListingConfigQueryOptions.mockReturnValue({
    queryKey: ["getListingConfig", {}],
    enabled: true,
    queryFn,
  });
}

describe("useListingConfig", () => {
  afterEach(() => {
    getListingConfigQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns the config", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(CONFIG));

    const { result } = renderHookWithProviders(() => useListingConfig({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(CONFIG);
    expect(getListingConfigQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });

  it("takes no required parameters", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(CONFIG));

    const { result } = renderHookWithProviders(() => useListingConfig({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, forwardedOptions] = getListingConfigQueryOptions.mock.lastCall ?? [];
    expect(forwardedOptions?.query).toBeUndefined();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useListingConfig({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
