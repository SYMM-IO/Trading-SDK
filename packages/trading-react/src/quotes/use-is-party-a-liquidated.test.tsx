import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useIsPartyALiquidated } from "./use-is-party-a-liquidated";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

describe("useIsPartyALiquidated", () => {
  it("is disabled while `partyA` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useIsPartyALiquidated({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the partyA's liquidation flag", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(true);

    const { result } = renderHookWithProviders(() => useIsPartyALiquidated({ partyA: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "isPartyALiquidated",
        args: [TEST_EOA],
      }),
    );
  });
});
