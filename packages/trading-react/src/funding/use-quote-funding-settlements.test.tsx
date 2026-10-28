import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getQuoteFundingSettlementsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getQuoteFundingSettlementsQueryOptions };
});

import { useQuoteFundingSettlements } from "./use-quote-funding-settlements";

const RESULT = { rows: [], hasMore: false };

describe("useQuoteFundingSettlements", () => {
  afterEach(() => {
    getQuoteFundingSettlementsQueryOptions.mockReset();
  });

  it("wires the filters and the connected chain into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    getQuoteFundingSettlementsQueryOptions.mockReturnValue({
      queryKey: ["getQuoteFundingSettlements", {}],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() => useQuoteFundingSettlements({ ...{ quoteIds: [7334n] }, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getQuoteFundingSettlementsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ ...{ quoteIds: [7334n] }, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getQuoteFundingSettlementsQueryOptions.mockReturnValue({
      queryKey: ["getQuoteFundingSettlements", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useQuoteFundingSettlements({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
