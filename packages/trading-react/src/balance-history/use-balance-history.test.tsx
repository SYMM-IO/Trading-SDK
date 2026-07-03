import { BalanceChangeType, BalanceHistoryFilter, type GetBalanceHistoryReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getBalanceHistoryQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getBalanceHistoryQueryOptions };
});

import { useBalanceHistory } from "./use-balance-history";

const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const;

const RESULT: GetBalanceHistoryReturnType = {
  rows: [
    {
      id: "0xabc-20",
      type: BalanceChangeType.Deposit,
      amount: 9964904n,
      account: SUB,
      timestamp: 1781105589,
      transaction: "0xabc",
      isInternalTransfer: false,
      marginTransferType: null,
    },
  ],
};

describe("useBalanceHistory", () => {
  afterEach(() => {
    getBalanceHistoryQueryOptions.mockReset();
  });

  it("wires accounts + connected chain into the core query options and returns rows", async () => {
    const { config } = createMockSymmioConfig();
    getBalanceHistoryQueryOptions.mockReturnValue({
      queryKey: ["getBalanceHistory", { accounts: [SUB] }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() =>
      useBalanceHistory({ accounts: [SUB], filter: BalanceHistoryFilter.Deposit, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getBalanceHistoryQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accounts: [SUB], filter: BalanceHistoryFilter.Deposit, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getBalanceHistoryQueryOptions.mockReturnValue({
      queryKey: ["getBalanceHistory", { accounts: [SUB] }],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useBalanceHistory({ accounts: [SUB], config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
