import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSolverReadinessQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSolverReadinessQueryOptions };
});

import { useSolverReadiness } from "./use-solver-readiness";

function mockOptions(queryFn: () => Promise<unknown>) {
  getSolverReadinessQueryOptions.mockReturnValue({
    queryKey: ["getSolverReadiness", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSolverReadiness", () => {
  afterEach(() => {
    getSolverReadinessQueryOptions.mockReset();
  });

  it("wires chainId and solverId into the core query options and returns readiness", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue({ isReady: true }));

    const { result } = renderHookWithProviders(() => useSolverReadiness({ config, chainId: 8453, solverId: "rasa" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ isReady: true });
    expect(getSolverReadinessQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 8453, solverId: "rasa" }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue({ isReady: true }));

    renderHookWithProviders(() => useSolverReadiness({ config }));

    await waitFor(() => expect(getSolverReadinessQueryOptions).toHaveBeenCalled());
    expect(getSolverReadinessQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });
});
