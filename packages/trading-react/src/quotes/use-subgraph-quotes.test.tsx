import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSubgraphQuotesQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSubgraphQuotesQueryOptions };
});

import { useSubgraphQuotes } from "./use-subgraph-quotes";

const RESULT = { rows: [], hasMore: false };

describe("useSubgraphQuotes", () => {
  afterEach(() => {
    getSubgraphQuotesQueryOptions.mockReset();
  });

  it("wires the filters and the connected chain into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    getSubgraphQuotesQueryOptions.mockReturnValue({
      queryKey: ["getSubgraphQuotes", {}],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() => useSubgraphQuotes({ ...{ quoteIds: [7334n] }, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getSubgraphQuotesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ ...{ quoteIds: [7334n] }, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getSubgraphQuotesQueryOptions.mockReturnValue({
      queryKey: ["getSubgraphQuotes", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useSubgraphQuotes({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
