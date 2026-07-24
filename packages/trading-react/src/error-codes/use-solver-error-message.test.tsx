import type { GetSolverErrorCodesReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSolverErrorCodesQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSolverErrorCodesQueryOptions };
});

import { useSolverErrorMessage } from "./use-solver-error-message";

const RESULT: GetSolverErrorCodesReturnType = {
  2000: "Insufficient balance",
  3000: "Quote expired",
};

function mockOptions(queryFn: () => Promise<unknown>) {
  getSolverErrorCodesQueryOptions.mockReturnValue({
    queryKey: ["getSolverErrorCodes", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSolverErrorMessage", () => {
  afterEach(() => {
    getSolverErrorCodesQueryOptions.mockReset();
  });

  it("resolves a known code to its message once the map loads", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useSolverErrorMessage(2000, { config }));

    await waitFor(() => expect(result.current).toBe("Insufficient balance"));
  });

  it("returns undefined for a code the solver does not register", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useSolverErrorMessage(9999, { config }));

    // Wait for the map to load, then confirm the missing code stays unresolved.
    await waitFor(() => expect(getSolverErrorCodesQueryOptions).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBeUndefined());
    expect(result.current).toBeUndefined();
  });

  it("returns undefined while the map is still loading", () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn(() => new Promise<GetSolverErrorCodesReturnType>(() => {})));

    const { result } = renderHookWithProviders(() => useSolverErrorMessage(2000, { config }));

    expect(result.current).toBeUndefined();
  });

  it("returns undefined when the code is null", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useSolverErrorMessage(null, { config }));

    await waitFor(() => expect(getSolverErrorCodesQueryOptions).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when no code is provided", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useSolverErrorMessage(undefined, { config }));

    await waitFor(() => expect(getSolverErrorCodesQueryOptions).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });

  it("forwards parameters (config, chainId) to the underlying map query", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSolverErrorMessage(2000, { config, chainId: 42161 }));

    await waitFor(() => expect(getSolverErrorCodesQueryOptions).toHaveBeenCalled());
    expect(getSolverErrorCodesQueryOptions).toHaveBeenCalledWith(config, expect.objectContaining({ chainId: 42161 }));
  });
});
