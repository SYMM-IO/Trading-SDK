import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getMarginTransfersQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getMarginTransfersQueryOptions };
});

import { useMarginTransfers } from "./use-margin-transfers";

const RESULT = { rows: [], hasMore: false };

describe("useMarginTransfers", () => {
  afterEach(() => {
    getMarginTransfersQueryOptions.mockReset();
  });

  it("wires the filters and the connected chain into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    getMarginTransfersQueryOptions.mockReturnValue({
      queryKey: ["getMarginTransfers", {}],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() =>
      useMarginTransfers({ ...{ types: ["ADD"], transactions: ["0xopen"] }, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getMarginTransfersQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ ...{ transactions: ["0xopen"] }, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMarginTransfersQueryOptions.mockReturnValue({
      queryKey: ["getMarginTransfers", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useMarginTransfers({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
