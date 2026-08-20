import { OrderType, PositionType, type GetInstantOpensReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";

const getInstantOpensQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getInstantOpensQueryOptions };
});

import { useLimitOrders } from "./use-limit-orders";

function instantOpensReturning(rows: GetInstantOpensReturnType) {
  getInstantOpensQueryOptions.mockReturnValue({
    queryKey: ["getInstantOpens", { partyA: TEST_EOA }],
    enabled: true,
    queryFn: vi.fn().mockResolvedValue(rows),
  });
}

const OFFCHAIN_LIMIT: GetInstantOpensReturnType = [
  {
    kind: "rasa",
    tempQuoteId: -771,
    marketId: 7,
    positionType: PositionType.LONG,
    orderType: OrderType.LIMIT,
    partyA: TEST_EOA,
    requestedOpenPrice: "64000",
    quantity: "0.1",
    cva: "2",
    lf: "0.5",
    partyAmm: "1",
    partyBmm: "0",
  },
];

describe("useLimitOrders", () => {
  afterEach(() => {
    getInstantOpensQueryOptions.mockReset();
  });

  it("returns no quotes and never reads while `partyA` is undefined", () => {
    const { config, readContract } = createMockSymmioConfig();
    instantOpensReturning([]);

    const { result } = renderHookWithProviders(() => useLimitOrders({ config }));

    expect(result.current.quotes).toEqual([]);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("surfaces a just-sent LIMIT order as an off-chain row before it anchors", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValue([]); // no on-chain pending quotes / empty VA lookup
    instantOpensReturning(OFFCHAIN_LIMIT);

    const { result } = renderHookWithProviders(() => useLimitOrders({ partyA: TEST_EOA, config }));

    await waitFor(() => expect(result.current.quotes.length).toBe(1));
    const row = result.current.quotes[0]!;
    expect(row.origin).toBe("offchain");
    expect(row.orderType).toBe(OrderType.LIMIT);
    expect(row.tempQuoteId).toBe(-771);
  });

  it("filters out non-LIMIT off-chain rows", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValue([]);
    instantOpensReturning([{ ...OFFCHAIN_LIMIT[0]!, orderType: OrderType.MARKET }]);

    const { result } = renderHookWithProviders(() => useLimitOrders({ partyA: TEST_EOA, config }));

    // Let the off-chain query resolve, then assert nothing LIMIT-shaped surfaced.
    await waitFor(() => expect(getInstantOpensQueryOptions).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.quotes).toEqual([]);
  });
});
