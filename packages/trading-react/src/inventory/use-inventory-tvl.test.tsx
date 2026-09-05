import { SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getInventoryTvlQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getInventoryTvlQueryOptions };
});

import { useInventoryTvl } from "./use-inventory-tvl";

const TVL = 436590910442466678775861n;

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  getInventoryTvlQueryOptions.mockReturnValue({ queryKey: ["getInventoryTvl", {}], enabled, queryFn });
}

describe("useInventoryTvl", () => {
  afterEach(() => {
    getInventoryTvlQueryOptions.mockReset();
  });

  it("takes no parameters and returns the aggregate as an 18-decimal bigint", async () => {
    mockOptions(vi.fn().mockResolvedValue(TVL));

    const { result } = renderHookWithProviders(() => useInventoryTvl());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(TVL);
  });

  it("defaults the chain to the connected one", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(TVL));

    renderHookWithProviders(() => useInventoryTvl({ config }));

    await waitFor(() => expect(getInventoryTvlQueryOptions).toHaveBeenCalled());
    expect(getInventoryTvlQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });

  it("keeps an explicit chainId instead of overriding it with the connected one", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(TVL));

    renderHookWithProviders(() => useInventoryTvl({ config, chainId: SymmioSupportedChainId.BASE }));

    await waitFor(() =>
      expect(getInventoryTvlQueryOptions).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ chainId: SymmioSupportedChainId.BASE }),
      ),
    );
  });

  it("stays idle when the core options disable the query", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(TVL);
    mockOptions(queryFn, false);

    const { result } = renderHookWithProviders(() => useInventoryTvl({ config }));

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useInventoryTvl({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
