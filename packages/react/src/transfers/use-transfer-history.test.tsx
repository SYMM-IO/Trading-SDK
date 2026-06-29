import type { GetTransferHistoryReturnType } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getTransferHistoryQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getTransferHistoryQueryOptions };
});

import { useTransferHistory } from "./use-transfer-history";

const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const;
const OTHER = "0x4AF4cd703760C4F018cEF5059a43b2624cdEB038" as const;

const RESULT: GetTransferHistoryReturnType = {
  rows: [
    {
      id: "0xtx-1",
      from: SUB,
      to: OTHER,
      amount: 600431998398848000n,
      timestamp: 1781100000,
      transaction: "0xdead",
      direction: "outgoing",
    },
  ],
};

describe("useTransferHistory", () => {
  afterEach(() => {
    getTransferHistoryQueryOptions.mockReset();
  });

  it("wires accounts + connected chain into the core query options and returns rows", async () => {
    const { config } = createMockSymmioConfig();
    getTransferHistoryQueryOptions.mockReturnValue({
      queryKey: ["getTransferHistory", { accounts: [SUB] }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() =>
      useTransferHistory({ accounts: [SUB], direction: "outgoing", config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getTransferHistoryQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accounts: [SUB], direction: "outgoing", chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getTransferHistoryQueryOptions.mockReturnValue({
      queryKey: ["getTransferHistory", { accounts: [SUB] }],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useTransferHistory({ accounts: [SUB], config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
