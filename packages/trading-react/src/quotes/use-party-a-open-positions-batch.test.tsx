import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { usePartyAOpenPositionsBatch } from "./use-party-a-open-positions-batch";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const VA_1: Address = "0x00000000000000000000000000000000000000a1";
const VA_2: Address = "0x00000000000000000000000000000000000000a2";

describe("usePartyAOpenPositionsBatch", () => {
  it("is idle while `partyAs` is empty and never reads", () => {
    const { config, multicall } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => usePartyAOpenPositionsBatch({ partyAs: [], config }));

    expect(result.current.isFetching).toBe(false);
    expect(multicall).not.toHaveBeenCalled();
  });

  it("reads every account in one multicall and reports each one", async () => {
    const { config, multicall } = createMockSymmioConfig();
    const revert = new Error("execution reverted");
    multicall.mockResolvedValueOnce([
      { status: "success", result: [{ id: 1n }] },
      { status: "success", result: true },
      { status: "failure", error: revert },
      { status: "success", result: false },
    ]);

    const { result } = renderHookWithProviders(() =>
      usePartyAOpenPositionsBatch({ partyAs: [VA_1, VA_2], includeLiquidationStatus: true, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(multicall).toHaveBeenCalledWith({
      allowFailure: true,
      contracts: [
        expect.objectContaining({
          address: DEFAULT.addresses.symmioAddress,
          functionName: "getPartyAOpenPositions",
          args: [VA_1, 0n, 200n],
        }),
        expect.objectContaining({ functionName: "isPartyALiquidated", args: [VA_1] }),
        expect.objectContaining({ functionName: "getPartyAOpenPositions", args: [VA_2, 0n, 200n] }),
        expect.objectContaining({ functionName: "isPartyALiquidated", args: [VA_2] }),
      ],
    });
    expect(result.current.data).toEqual([
      { partyA: VA_1, start: 0n, status: "success", quotes: [{ id: 1n }], hasMore: false, isLiquidated: true },
      { partyA: VA_2, start: 0n, status: "failure", error: revert },
    ]);
  });
});
