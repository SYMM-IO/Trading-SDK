import {
  OrderType,
  PositionType,
  QuoteCloseEventType,
  QuoteCloseType,
  QuoteStatus,
  type GetQuoteHistoryReturnType,
} from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getQuoteHistoryQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getQuoteHistoryQueryOptions };
});

import { useQuoteHistory } from "./use-quote-history";

const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const;

const RESULT: GetQuoteHistoryReturnType = {
  rows: [
    {
      eventId: "e1",
      closeEventType: QuoteCloseEventType.FillClose,
      closedAt: 1782000000,
      quoteId: 8232n,
      marketId: 149,
      symbol: "X",
      positionType: PositionType.LONG,
      orderType: OrderType.MARKET,
      quoteStatus: QuoteStatus.CLOSED,
      quantity: 1n,
      openedPrice: 1n,
      requestedOpenPrice: 1n,
      avgClosedPrice: 2n,
      closedAmount: 1n,
      quantityToClose: 0n,
      liquidateAmount: 0n,
      liquidatePrice: 0n,
      partyA: SUB,
      partyB: null,
      subAccount: SUB,
      rawMetadata: null,
    },
  ],
};

describe("useQuoteHistory", () => {
  afterEach(() => {
    getQuoteHistoryQueryOptions.mockReset();
  });

  it("wires subAccounts + connected chain into the core query options and returns rows", async () => {
    const { config } = createMockSymmioConfig();
    getQuoteHistoryQueryOptions.mockReturnValue({
      queryKey: ["getQuoteHistory", { subAccounts: [SUB] }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() =>
      useQuoteHistory({ subAccounts: [SUB], closeType: QuoteCloseType.Closed, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getQuoteHistoryQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ subAccounts: [SUB], closeType: QuoteCloseType.Closed, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getQuoteHistoryQueryOptions.mockReturnValue({
      queryKey: ["getQuoteHistory", { subAccounts: [SUB] }],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useQuoteHistory({ subAccounts: [SUB], config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
