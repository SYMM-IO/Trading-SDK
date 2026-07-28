import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const addSolverWhitelistMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, addSolverWhitelistMutationOptions };
});

import { useAddSolverWhitelist } from "./use-add-solver-whitelist";

const USER = "0x1111111111111111111111111111111111111111" as const;

describe("useAddSolverWhitelist", () => {
  afterEach(() => {
    addSolverWhitelistMutationOptions.mockReset();
  });

  it("forwards the variables to the core mutation and resolves its result", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue({ successful: true, message: null });
    addSolverWhitelistMutationOptions.mockReturnValue({ mutationKey: ["addSolverWhitelist"], mutationFn });

    const { result } = renderHookWithProviders(() => useAddSolverWhitelist({ config }));
    result.current.mutate({ address: USER, chainId: 8453, solverId: "rasa" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ successful: true, message: null });
    expect(mutationFn).toHaveBeenCalledWith(
      expect.objectContaining({ address: USER, chainId: 8453, solverId: "rasa" }),
    );
  });

  it("defaults chainId to the connected chain when the variables omit it", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue({ successful: true, message: null });
    addSolverWhitelistMutationOptions.mockReturnValue({ mutationKey: ["addSolverWhitelist"], mutationFn });

    const { result } = renderHookWithProviders(() => useAddSolverWhitelist({ config }));
    result.current.mutate({ address: USER });

    await waitFor(() => expect(mutationFn).toHaveBeenCalled());
    expect(mutationFn).toHaveBeenCalledWith(expect.objectContaining({ address: USER, chainId: expect.any(Number) }));
  });
});
