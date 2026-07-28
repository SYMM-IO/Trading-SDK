import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const searchSolverNotificationsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, searchSolverNotificationsQueryOptions };
});

import { useSearchSolverNotifications } from "./use-search-solver-notifications";

const USER = "0x1111111111111111111111111111111111111111" as const;
const RESULT = { count: 0, notification_data: [] };

function mockOptions(queryFn: () => Promise<unknown>) {
  searchSolverNotificationsQueryOptions.mockReturnValue({
    queryKey: ["searchSolverNotifications", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSearchSolverNotifications", () => {
  afterEach(() => {
    searchSolverNotificationsQueryOptions.mockReset();
  });

  it("wires paging and filters into the core query options and returns the page", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      useSearchSolverNotifications({
        config,
        chainId: 8453,
        solverId: "rasa",
        start: 0,
        size: 5,
        counterpartyAddress: USER,
        quoteId: 9,
        timestampGte: 300,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(searchSolverNotificationsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        chainId: 8453,
        solverId: "rasa",
        start: 0,
        size: 5,
        counterpartyAddress: USER,
        quoteId: 9,
        timestampGte: 300,
      }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSearchSolverNotifications({ config, start: 0, size: 5 }));

    await waitFor(() => expect(searchSolverNotificationsQueryOptions).toHaveBeenCalled());
    expect(searchSolverNotificationsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number), start: 0, size: 5 }),
    );
  });
});
