import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getFundingIndexCheckpointsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getFundingIndexCheckpointsQueryOptions };
});

import { useFundingIndexCheckpoints } from "./use-funding-index-checkpoints";

const RESULT = { rows: [], hasMore: false };

describe("useFundingIndexCheckpoints", () => {
  afterEach(() => {
    getFundingIndexCheckpointsQueryOptions.mockReset();
  });

  it("wires the filters and the connected chain into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    getFundingIndexCheckpointsQueryOptions.mockReturnValue({
      queryKey: ["getFundingIndexCheckpoints", {}],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(RESULT),
    });

    const { result } = renderHookWithProviders(() => useFundingIndexCheckpoints({ ...{ marketIds: [42] }, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getFundingIndexCheckpointsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ ...{ marketIds: [42] }, chainId: expect.any(Number) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getFundingIndexCheckpointsQueryOptions.mockReturnValue({
      queryKey: ["getFundingIndexCheckpoints", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("subgraph down")),
    });

    const { result } = renderHookWithProviders(() => useFundingIndexCheckpoints({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
