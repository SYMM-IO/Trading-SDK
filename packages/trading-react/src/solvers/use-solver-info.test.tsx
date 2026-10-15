import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSolverInfoQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSolverInfoQueryOptions };
});

import { useSolverInfo } from "./use-solver-info";

function mockOptions(queryFn: () => Promise<unknown>) {
  getSolverInfoQueryOptions.mockReturnValue({
    queryKey: ["getSolverInfo", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSolverInfo", () => {
  afterEach(() => {
    getSolverInfoQueryOptions.mockReset();
  });

  it("wires chainId and solverId into the core query options and returns the info", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0.25" }));

    const { result } = renderHookWithProviders(() => useSolverInfo({ config, chainId: 42161, solverId: "enigma" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0.25" });
    expect(getSolverInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 42161, solverId: "enigma" }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue({}));

    renderHookWithProviders(() => useSolverInfo({ config }));

    await waitFor(() => expect(getSolverInfoQueryOptions).toHaveBeenCalled());
    expect(getSolverInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });
});
