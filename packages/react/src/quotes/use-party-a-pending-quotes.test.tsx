import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { usePartyAPendingQuotes } from "./use-party-a-pending-quotes";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("usePartyAPendingQuotes", () => {
  it("is disabled while `partyA` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => usePartyAPendingQuotes({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the partyA's pending quote ids", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([1n, 2n]);

    const { result } = renderHookWithProviders(() => usePartyAPendingQuotes({ partyA: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([1n, 2n]);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getPartyAPendingQuotes",
        args: [TEST_EOA],
      }),
    );
  });
});
