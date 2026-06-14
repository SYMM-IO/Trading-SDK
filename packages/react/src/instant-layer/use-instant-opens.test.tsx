import { OrderType, PositionType, type GetInstantOpensReturnType } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getInstantOpensQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getInstantOpensQueryOptions };
});

import { useInstantOpens } from "./use-instant-opens";

const PARTY_A = "0x00000000000000000000000000000000000000a1" as const;
const RESULT: GetInstantOpensReturnType = [
  {
    tempQuoteId: -1001,
    marketId: 7,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    partyA: PARTY_A,
    requestedOpenPrice: "1.5",
    quantity: "100",
    cva: "2",
    lf: "0.5",
    partyAmm: "1",
    partyBmm: "0",
  },
];

describe("useInstantOpens", () => {
  afterEach(() => {
    getInstantOpensQueryOptions.mockReset();
  });

  it("wires partyA + connected chain into the core query options and returns the data", async () => {
    const { config } = createMockSymmioConfig();
    getInstantOpensQueryOptions.mockReturnValue({
      queryKey: ["getInstantOpens", { partyA: PARTY_A }],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() => useInstantOpens({ partyA: PARTY_A, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getInstantOpensQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ partyA: PARTY_A, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getInstantOpensQueryOptions.mockReturnValue({
      queryKey: ["getInstantOpens", { partyA: PARTY_A }],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("hedger down")),
    });

    const { result } = renderHookWithProviders(() => useInstantOpens({ partyA: PARTY_A, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
