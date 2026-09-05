import { PoolTransactionStatus, PoolTransactionType, type GetUserTransactionsReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getUserTransactionsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getUserTransactionsQueryOptions };
});

import { useUserTransactions } from "./use-user-transactions";

const PAGE: GetUserTransactionsReturnType = {
  count: 5,
  items: [
    {
      transactionId: "tx-1",
      type: PoolTransactionType.WITHDRAW,
      status: PoolTransactionStatus.PENDING,
      amount: 5_300_000_000_000_000_000n,
      tokenDecimals: 18,
      tokenAddress: "0xToken",
      tokenName: "Demo",
      tokenTicker: "DEMO",
      chainId: 999,
      wallet: null,
      refundAddress: null,
      transactionHash: "0xabc",
      time: 1_700_000_000,
    },
  ],
};

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  getUserTransactionsQueryOptions.mockReturnValue({ queryKey: ["getUserTransactions", {}], enabled, queryFn });
}

describe("useUserTransactions", () => {
  afterEach(() => {
    getUserTransactionsQueryOptions.mockReset();
  });

  it("forwards the token and paging into the core query options and returns the page", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() => useUserTransactions({ config, accessToken: "t", size: 25 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE);
    expect(getUserTransactionsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accessToken: "t", size: 25, chainId: expect.any(Number) }),
    );
  });

  it("reports the backend's total count, not the page length", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(PAGE));

    const { result } = renderHookWithProviders(() => useUserTransactions({ config, accessToken: "t" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.count).toBe(5);
    expect(result.current.data!.items).toHaveLength(1);
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() => useUserTransactions({ config, accessToken: "t" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
