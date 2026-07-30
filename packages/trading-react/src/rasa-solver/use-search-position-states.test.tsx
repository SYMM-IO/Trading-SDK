import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const searchPositionStatesQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, searchPositionStatesQueryOptions };
});

import { useSearchPositionStates } from "./use-search-position-states";

const USER = "0x1111111111111111111111111111111111111111" as const;
const RESULT = { count: 0, position_state: [] };

function mockOptions(queryFn: () => Promise<unknown>) {
  searchPositionStatesQueryOptions.mockReturnValue({
    queryKey: ["searchPositionStates", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSearchPositionStates", () => {
  afterEach(() => {
    searchPositionStatesQueryOptions.mockReset();
  });

  it("wires paging and filters into the core query options and returns the page", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      useSearchPositionStates({
        config,
        chainId: 8453,
        solverId: "rasa",
        start: 0,
        size: 10,
        address: USER,
        quoteId: 7,
        createTimeGte: 100,
        modifyTimeGte: 200,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(searchPositionStatesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        chainId: 8453,
        solverId: "rasa",
        start: 0,
        size: 10,
        address: USER,
        quoteId: 7,
        createTimeGte: 100,
        modifyTimeGte: 200,
      }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSearchPositionStates({ config, start: 0, size: 10 }));

    await waitFor(() => expect(searchPositionStatesQueryOptions).toHaveBeenCalled());
    expect(searchPositionStatesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number), start: 0, size: 10 }),
    );
  });
});
