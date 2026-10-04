import type { FundingFee } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useFundingFeesOfPartyB } from "./use-funding-fees-of-party-b";

const SYMBOL_ID = 4n;
const PARTY_B: Address = "0x000000000000000000000000000000000000b22b";

/** An accruing pair: a duration is set and accrual has started. */
const FUNDING_FEE: FundingFee = {
  currentLongRate: 12_000000000000n,
  currentShortRate: -12_000000000000n,
  accumulatedLongRate: 10_000000000000n,
  accumulatedShortRate: -10_000000000000n,
  lastUpdatedEpoch: 496_485n,
  lastUpdatedTimeStamp: 1_787345777n,
  startEpochTimeStamp: 1_787340000n,
  startEpoch: 496_483n,
  epochDuration: 3_600n,
  snapshotLongFee: 0n,
  snapshotShortFee: 0n,
};

describe("useFundingFeesOfPartyB", () => {
  it("reads the pair's funding state from the diamond", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(FUNDING_FEE);

    const { result } = renderHookWithProviders(() =>
      useFundingFeesOfPartyB({ symbolId: SYMBOL_ID, partyB: PARTY_B, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(FUNDING_FEE);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "getFundingFeesOfPartyB",
        args: [SYMBOL_ID, PARTY_B],
      }),
    );
  });

  it("does not read while `query.enabled` is false", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() =>
      useFundingFeesOfPartyB({ symbolId: SYMBOL_ID, partyB: PARTY_B, query: { enabled: false }, config }),
    );

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() =>
      useFundingFeesOfPartyB({ symbolId: SYMBOL_ID, partyB: PARTY_B, config }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
