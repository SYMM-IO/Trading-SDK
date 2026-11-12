import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useDeallocateDebounceTime } from "./use-deallocate-debounce-time";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

describe("useDeallocateDebounceTime", () => {
  it("reads the deallocate debounce from the SYMMIO core", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(300n);

    const { result } = renderHookWithProviders(() => useDeallocateDebounceTime({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getDeallocateDebounceTime",
      }),
    );
    expect(result.current.data).toBe(300n);
  });

  it("does not read while the caller disables the query", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() => useDeallocateDebounceTime({ config, query: { enabled: false } }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });
});
