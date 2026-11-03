import { keepPreviousData, QueryClient } from "@tanstack/react-query";
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

  it("keeps a disabled info query idle when solver configuration cannot be resolved", () => {
    const { config } = createMockSymmioConfig();
    vi.spyOn(config, "getSolver").mockImplementation(() => {
      throw new Error("unknown solver");
    });
    getSolverInfoQueryOptions.mockReturnValue({ queryKey: ["disabled-info"], enabled: false, queryFn: vi.fn() });
    const { result } = renderHookWithProviders(() => useSolverInfo({ config, query: { enabled: false } }));
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.knownTimelockApproval).toBeUndefined();
  });
  it("ignores unrelated queries with custom bigint-safe keys", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue({}));
    const queryClient = new QueryClient();
    queryClient.setQueryDefaults(["foreign"], { queryKeyHashFn: (key) => String(key[0]) + String(key[1]) });
    const { result } = renderHookWithProviders(() => useSolverInfo({ config }), { queryClient });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(() => queryClient.setQueryData(["foreign", 1n], "ok")).not.toThrow();
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
  it("exposes deployment timelock metadata without changing the existing fee fields", async () => {
    const { config } = createMockSymmioConfig();
    const timelockApproval = {
      unlocker: "0x2222222222222222222222222222222222222222",
      minTimelockDelaySeconds: 600,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig().addresses.accountLayerAddress,
      },
    };
    mockOptions(vi.fn().mockResolvedValue({ staticSolverFeeOpen: "0.5", timelockApproval }));
    const { result } = renderHookWithProviders(() => useSolverInfo({ config }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ staticSolverFeeOpen: "0.5", timelockApproval });
    expect(result.current.knownTimelockApproval).toEqual(timelockApproval);
  });
  it("retains confirmed support when a later info response omits it", async () => {
    const { config } = createMockSymmioConfig();
    const capability = {
      unlocker: "0x2222222222222222222222222222222222222222",
      minTimelockDelaySeconds: 600,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig().addresses.accountLayerAddress,
      },
    };
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ timelockApproval: capability })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("offline"));
    mockOptions(queryFn);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHookWithProviders(() => useSolverInfo({ config }), { queryClient });
    await waitFor(() => expect(result.current.knownTimelockApproval).toEqual(capability));
    await result.current.refetch();
    await waitFor(() => expect(result.current.data).toEqual({}));
    expect(result.current.knownTimelockApproval).toEqual(capability);
    await result.current.refetch();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.knownTimelockApproval).toEqual(capability);
  });
  it("does not treat previous-solver placeholder data as support for another solver URL", async () => {
    const { config: first } = createMockSymmioConfig();
    const { config: second } = createMockSymmioConfig();
    const secondSolver = second.getSolver();
    vi.spyOn(second, "getSolver").mockReturnValue({ ...secondSolver, url: `${secondSolver.url}/other` });
    const capability = {
      unlocker: "0x2222222222222222222222222222222222222222",
      minTimelockDelaySeconds: 600,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: first.getChainConfig().addresses.accountLayerAddress,
      },
    };
    let release!: (value: object) => void;
    const pending = new Promise<object>((resolve) => {
      release = resolve;
    });
    getSolverInfoQueryOptions.mockImplementation((config) => ({
      queryKey: ["getSolverInfo", config === first ? "first" : "second"],
      enabled: true,
      placeholderData: keepPreviousData,
      queryFn: () => (config === first ? Promise.resolve({ timelockApproval: capability }) : pending),
    }));
    const queryClient = new QueryClient();
    const { result, rerender } = renderHookWithProviders(
      ({ config }: { config: typeof first }) => useSolverInfo({ config }),
      { queryClient, initialProps: { config: first } },
    );
    await waitFor(() => expect(result.current.knownTimelockApproval).toEqual(capability));
    rerender({ config: second });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.knownTimelockApproval).toBeUndefined();
    release({});
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.knownTimelockApproval).toBeUndefined();
  });
});
