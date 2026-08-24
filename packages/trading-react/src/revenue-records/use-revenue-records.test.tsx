import type { GetRevenueRecordsReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getRevenueRecordsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getRevenueRecordsQueryOptions };
});

import { useRevenueRecords } from "./use-revenue-records";

const RESULT: GetRevenueRecordsReturnType = {
  records: [{ id: 7, symbolId: 3, amount: "12.5", createdAt: "2026-08-24T00:00:00Z" }],
  count: 42,
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getRevenueRecordsQueryOptions.mockReturnValue({
    queryKey: ["getRevenueRecords", {}],
    enabled: true,
    queryFn,
  });
}

describe("useRevenueRecords", () => {
  afterEach(() => {
    getRevenueRecordsQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns data without default polling", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useRevenueRecords({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getRevenueRecordsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
    const [, forwardedOptions] = getRevenueRecordsQueryOptions.mock.lastCall ?? [];
    expect(forwardedOptions?.query).toBeUndefined();
  });

  it("forwards paging params into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useRevenueRecords({ config, id: 10, symbolIds: [1, 2], limit: 50 }));

    await waitFor(() => expect(getRevenueRecordsQueryOptions).toHaveBeenCalled());
    expect(getRevenueRecordsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ id: 10, symbolIds: [1, 2], limit: 50 }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useRevenueRecords({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
