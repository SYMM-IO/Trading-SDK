import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useAuthenticateSolver } from "./use-authenticate-solver";
import { useCancelLegacyConditionalOrder } from "./use-cancel-legacy-conditional-order";
import { useCreateLegacyConditionalOrder } from "./use-create-legacy-conditional-order";
import { useGetSolverSignInMessage } from "./use-get-solver-sign-in-message";
import { useLegacyCollateralLocked } from "./use-legacy-collateral-locked";
import { useLegacyOrderHistory } from "./use-legacy-order-history";

const { mutate, read, factories } = vi.hoisted(() => ({
  mutate: vi.fn(),
  read: vi.fn(),
  factories: [
    "getSolverSignInMessageMutationOptions",
    "authenticateSolverMutationOptions",
    "createLegacyConditionalOrderMutationOptions",
    "cancelLegacyConditionalOrderMutationOptions",
  ],
}));
vi.mock("@symmio/trading-core", async (original) => {
  const actual = await original<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    ...Object.fromEntries(factories.map((name) => [name, () => ({ retry: false, mutationFn: mutate })])),
    getLegacyOrderHistoryQueryOptions: (_config: unknown, options: unknown) => ({
      queryKey: ["legacy-history", options],
      queryFn: read,
    }),
    getLegacyCollateralLockedQueryOptions: (_config: unknown, options: unknown) => ({
      queryKey: ["legacy-collateral", options],
      queryFn: read,
    }),
  };
});

beforeEach(() => {
  mutate.mockReset();
  read.mockReset();
});
const target = { chainId: 42161, solverId: "enigma" as const };
const challenge = {
  owner: TEST_EOA,
  message: "signed text",
  nonce: "12345678",
  issuedAt: "2026-11-15T00:00:00.000Z",
  expirationTime: "2027-11-15T00:00:00.000Z",
};

describe("legacy hooks", () => {
  it("requests challenges only on demand and forwards explicit lifetime and cancellation", async () => {
    const { config } = createMockSymmioConfig();
    mutate.mockResolvedValue(challenge);
    const { result } = renderHookWithProviders(() => useGetSolverSignInMessage({ config }));
    expect(mutate).not.toHaveBeenCalled();
    const input = {
      ...target,
      owner: TEST_EOA,
      account: TEST_EOA,
      domain: "example.com",
      issuedAt: challenge.issuedAt,
      expirationTime: challenge.expirationTime,
      signal: new AbortController().signal,
    };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(mutate).toHaveBeenCalledWith(input);
  });
  it("passes the signed challenge and optional signType unchanged", async () => {
    const { config } = createMockSymmioConfig();
    mutate.mockResolvedValue({ accessToken: "test-token" });
    const { result } = renderHookWithProviders(() => useAuthenticateSolver({ config }));
    const input = {
      ...target,
      challenge,
      signature: "signature",
      signType: "ERC4337",
      signal: new AbortController().signal,
    };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(mutate).toHaveBeenCalledWith(input);
  });
  it("preserves all order fields and the explicitly selected deployment", async () => {
    const { config } = createMockSymmioConfig();
    mutate.mockResolvedValue({});
    const { result } = renderHookWithProviders(() => useCreateLegacyConditionalOrder({ config }));
    const input = {
      ...target,
      accessToken: "test-token",
      signal: new AbortController().signal,
      order: {
        account: TEST_EOA,
        vaAddress: TEST_EOA,
        symbolId: 4,
        conditionalOrderType: "take_profit" as const,
        quantity: "1.000000000000000001",
        triggerPrice: "2",
        limitPrice: "3",
        side: "long" as const,
        quoteId: 7,
      },
    };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(mutate).toHaveBeenCalledWith(input);
  });
  it("normalizes cancellation errors and makes one request", async () => {
    const { config } = createMockSymmioConfig();
    mutate.mockRejectedValue(new Error("failed"));
    const { result } = renderHookWithProviders(() => useCancelLegacyConditionalOrder({ config }));
    const input = { ...target, accessToken: "test-token", orderId: "order/7", signal: new AbortController().signal };
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ kind: expect.any(String) });
    });
    expect(mutate).toHaveBeenCalledExactlyOnceWith(input);
  });
  it.each([useLegacyOrderHistory, useLegacyCollateralLocked])(
    "forwards query cancellation to the core factory",
    async (hook) => {
      const { config } = createMockSymmioConfig();
      let signal: AbortSignal | undefined;
      read.mockImplementation((context: { signal: AbortSignal }) => {
        signal = context.signal;
        return new Promise(() => {});
      });
      const { unmount } = renderHookWithProviders(() =>
        hook({ config, ...target, account: TEST_EOA, accessToken: "test-token" }),
      );
      await waitFor(() => expect(signal).toBeDefined());
      expect(signal!.aborted).toBe(false);
      unmount();
      expect(signal!.aborted).toBe(true);
    },
  );
});
