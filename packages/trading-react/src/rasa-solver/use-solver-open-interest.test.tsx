import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSolverOpenInterestQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSolverOpenInterestQueryOptions };
});

import { useSolverOpenInterest } from "./use-solver-open-interest";

const RESULT = { total_cap: "100", used: "40" };

function mockOptions(queryFn: () => Promise<unknown>) {
  getSolverOpenInterestQueryOptions.mockReturnValue({
    queryKey: ["getSolverOpenInterest", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSolverOpenInterest", () => {
  afterEach(() => {
    getSolverOpenInterestQueryOptions.mockReset();
  });

  it("wires chainId and solverId into the core query options and returns the totals", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      useSolverOpenInterest({ config, chainId: 8453, solverId: "rasa" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getSolverOpenInterestQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 8453, solverId: "rasa" }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSolverOpenInterest({ config }));

    await waitFor(() => expect(getSolverOpenInterestQueryOptions).toHaveBeenCalled());
    expect(getSolverOpenInterestQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });
});
