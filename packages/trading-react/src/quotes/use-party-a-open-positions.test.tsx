import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { usePartyAOpenPositions } from "./use-party-a-open-positions";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("usePartyAOpenPositions", () => {
  it("is disabled while `partyA` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => usePartyAOpenPositions({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the partyA's open positions with default pagination", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([]);

    const { result } = renderHookWithProviders(() => usePartyAOpenPositions({ partyA: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getPartyAOpenPositions",
        args: [TEST_EOA, 0n, 200n],
      }),
    );
  });

  it("still reads positions with `live` on (the settle subscription + VA lookup never block the query)", async () => {
    const { config, readContract } = createMockSymmioConfig();
    // `live` also fires a `getVirtualAccount` lookup to resolve the notification
    // stream, so answer every read (positions + VA detail) with an empty struct.
    readContract.mockResolvedValue([]);

    const { result } = renderHookWithProviders(() => usePartyAOpenPositions({ partyA: TEST_EOA, live: true, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getPartyAOpenPositions", args: [TEST_EOA, 0n, 200n] }),
    );
  });
});
