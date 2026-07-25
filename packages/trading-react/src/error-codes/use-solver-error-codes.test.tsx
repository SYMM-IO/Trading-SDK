import type { GetSolverErrorCodesReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSolverErrorCodesQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSolverErrorCodesQueryOptions };
});

import { useSolverErrorCodes } from "./use-solver-error-codes";

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

describe("useSolverErrorCodes", () => {
  afterEach(() => {
    getSolverErrorCodesQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns the code map", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useSolverErrorCodes({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getSolverErrorCodesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });

  it("prefers an explicit chainId over the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSolverErrorCodes({ config, chainId: 42161 }));

    await waitFor(() => expect(getSolverErrorCodesQueryOptions).toHaveBeenCalled());
    expect(getSolverErrorCodesQueryOptions).toHaveBeenCalledWith(config, expect.objectContaining({ chainId: 42161 }));
  });

  it("forwards consumer-supplied query overrides into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSolverErrorCodes({ config, query: { staleTime: 5_000 } }));

    await waitFor(() => expect(getSolverErrorCodesQueryOptions).toHaveBeenCalled());
    expect(getSolverErrorCodesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ query: expect.objectContaining({ staleTime: 5_000 }) }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useSolverErrorCodes({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("solver down");
  });
});
