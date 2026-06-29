import { BalanceHistoryFilter } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getBalanceHistoryQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getBalanceHistoryQueryOptions };
});

import { useDepositHistory } from "./use-deposit-history";

const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const;

describe("useDepositHistory", () => {
  afterEach(() => {
    getBalanceHistoryQueryOptions.mockReset();
  });

  it("pins filter to Deposit and forwards accounts", async () => {
    const { config } = createMockSymmioConfig();
    getBalanceHistoryQueryOptions.mockReturnValue({
      queryKey: ["getBalanceHistory", { accounts: [SUB] }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue({ rows: [] }),
    });

    const { result } = renderHookWithProviders(() => useDepositHistory({ accounts: [SUB], config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getBalanceHistoryQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accounts: [SUB], filter: BalanceHistoryFilter.Deposit }),
    );
  });
});
