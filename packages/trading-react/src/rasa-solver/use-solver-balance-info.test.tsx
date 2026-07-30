import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSolverBalanceInfoQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSolverBalanceInfoQueryOptions };
});

import { useSolverBalanceInfo } from "./use-solver-balance-info";

const USER = "0x1111111111111111111111111111111111111111" as const;
const RESULT = [{ party_a: null, party_b: null }];

function mockOptions(queryFn: () => Promise<unknown>) {
  getSolverBalanceInfoQueryOptions.mockReturnValue({
    queryKey: ["getSolverBalanceInfo", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSolverBalanceInfo", () => {
  afterEach(() => {
    getSolverBalanceInfoQueryOptions.mockReset();
  });

  it("wires chainId, solverId, and address into the core query options and returns the rows", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      useSolverBalanceInfo({ config, chainId: 8453, solverId: "rasa", address: USER }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getSolverBalanceInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 8453, solverId: "rasa", address: USER }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSolverBalanceInfo({ config, address: USER }));

    await waitFor(() => expect(getSolverBalanceInfoQueryOptions).toHaveBeenCalled());
    expect(getSolverBalanceInfoQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number), address: USER }),
    );
  });
});
