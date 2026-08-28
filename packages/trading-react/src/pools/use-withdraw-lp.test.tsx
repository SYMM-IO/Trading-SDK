import { act, waitFor } from "@testing-library/react";
import { base, hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const withdrawLpMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, withdrawLpMutationOptions };
});

import { useWithdrawLp } from "./use-withdraw-lp";

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  marketAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  withdrawAddress: "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A",
  amount: 1000000000000000000n,
} as const;

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  withdrawLpMutationOptions.mockReturnValue({ mutationKey: ["withdrawLp"], mutationFn });
}

describe("useWithdrawLp", () => {
  afterEach(() => {
    withdrawLpMutationOptions.mockReset();
  });

  it("forwards the variables and defaults chainId to the connected chain", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(undefined);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useWithdrawLp({ config }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: hyperEvm.id });
  });

  it("forwards an explicit chainId override unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(undefined);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useWithdrawLp({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...VARIABLES, chainId: base.id });
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARIABLES, chainId: base.id });
  });

  it("carries the optional description through only when set", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(undefined);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useWithdrawLp({ config }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });
    expect(mutationFn.mock.calls[0]![0]).not.toHaveProperty("description");

    await act(async () => {
      await result.current.mutateAsync({ ...VARIABLES, description: "cashing out" });
    });
    expect(mutationFn).toHaveBeenLastCalledWith(expect.objectContaining({ description: "cashing out" }));
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("withdraw failed")));

    const { result } = renderHookWithProviders(() => useWithdrawLp({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARIABLES);
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
