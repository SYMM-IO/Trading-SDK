import { AffiliateState } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useAffiliateState } from "./use-affiliate-state";

const AFFILIATE: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";

describe("useAffiliateState", () => {
  it("is disabled while `affiliate` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useAffiliateState({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe("pending");
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the affiliate state and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(AffiliateState.PENDING);

    const { result } = renderHookWithProviders(() => useAffiliateState({ affiliate: AFFILIATE, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(AffiliateState.PENDING);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getAffiliateState", args: [AFFILIATE] }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useAffiliateState({ affiliate: AFFILIATE, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
