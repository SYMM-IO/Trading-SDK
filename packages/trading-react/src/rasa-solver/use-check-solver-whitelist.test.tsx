import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const checkSolverWhitelistQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, checkSolverWhitelistQueryOptions };
});

import { useCheckSolverWhitelist } from "./use-check-solver-whitelist";

const USER = "0x1111111111111111111111111111111111111111" as const;

function mockOptions(queryFn: () => Promise<unknown>) {
  checkSolverWhitelistQueryOptions.mockReturnValue({
    queryKey: ["checkSolverWhitelist", {}],
    enabled: true,
    queryFn,
  });
}

describe("useCheckSolverWhitelist", () => {
  afterEach(() => {
    checkSolverWhitelistQueryOptions.mockReset();
  });

  it("wires chainId, solverId, and address into the core query options and returns the flag", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(true));

    const { result } = renderHookWithProviders(() =>
      useCheckSolverWhitelist({ config, chainId: 8453, solverId: "rasa", address: USER }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
    expect(checkSolverWhitelistQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 8453, solverId: "rasa", address: USER }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(false));

    renderHookWithProviders(() => useCheckSolverWhitelist({ config, address: USER }));

    await waitFor(() => expect(checkSolverWhitelistQueryOptions).toHaveBeenCalled());
    expect(checkSolverWhitelistQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number), address: USER }),
    );
  });
});
