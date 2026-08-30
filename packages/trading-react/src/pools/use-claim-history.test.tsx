import type { GetClaimHistoryReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getClaimHistoryQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getClaimHistoryQueryOptions };
});

import { useClaimHistory } from "./use-claim-history";

const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

const PAGE: GetClaimHistoryReturnType = {
  count: 3,
  items: [
    {
      claimRequestId: "claim-1",
      accountAddress: "0xSubAccount",
      amount: 37699391270769714n,
      transactionHash: "0xabc",
      time: 1_700_000_000,
    },
  ],
};

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  getClaimHistoryQueryOptions.mockReturnValue({ queryKey: ["getClaimHistory", {}], enabled, queryFn });
}

describe("useClaimHistory", () => {
  afterEach(() => {
    getClaimHistoryQueryOptions.mockReset();
  });

  it("forwards the token, paging and chainId into the core query options and returns the page", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() =>
      useClaimHistory({ config, accessToken: "t", tokenContractAddress: TOKEN, size: 25 }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);
    expect(getClaimHistoryQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accessToken: "t", tokenContractAddress: TOKEN, size: 25, chainId: expect.any(Number) }),
    );
  });

  it("reports the backend's total count, not the page length", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() => useClaimHistory({ config, accessToken: "t" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.count).toBe(3);
    expect(result.current.data!.items).toHaveLength(1);
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useClaimHistory({ config, accessToken: "t" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
