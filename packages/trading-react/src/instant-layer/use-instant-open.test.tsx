import {
  PositionType,
  getInstantClosesQueryKey,
  getInstantOpensQueryKey,
  type InstantOpenParameters,
  type InstantOpenReturnType,
} from "@symmio/trading-core";
import type { Query, QueryKey } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { arbitrum, hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, createTestQueryClient, renderHookWithProviders } from "../test/test-utils";

const instantOpenMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, instantOpenMutationOptions };
});

import { useInstantOpen } from "./use-instant-open";

const PARTY_A = "0x00000000000000000000000000000000000000a1" as const;
const VARS: InstantOpenParameters = {
  subAccountAddress: PARTY_A,
  marketId: 1,
  positionType: PositionType.LONG,
  order: { price: 50_000n * 10n ** 18n, quantity: 10n ** 18n },
  lockedParam: { cva: 2n, lf: 1n, partyAmm: 1n, partyBmm: 1n },
  margin: { amount: 100n * 10n ** 18n },
};
const RESULT: InstantOpenReturnType = { success: true, tempQuoteId: "-1001" };

/** `predicateMatch` only reads `query.queryKey`, so a minimal stub cast to `Query` is enough. */
function queryWith(key: QueryKey): Query<unknown, Error, unknown, QueryKey> {
  return { queryKey: key } as Query<unknown, Error, unknown, QueryKey>;
}

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  instantOpenMutationOptions.mockReturnValue({ mutationKey: ["instantOpen"], mutationFn });
}

describe("useInstantOpen", () => {
  afterEach(() => {
    instantOpenMutationOptions.mockReset();
  });

  it("calls the core mutationFn with the connected chain and returns the result", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(RESULT);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useInstantOpen({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toEqual(RESULT);
    expect(mutationFn).toHaveBeenCalledWith({ ...VARS, chainId: hyperEvm.id });
  });

  it("forwards an explicit chainId override unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(RESULT);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useInstantOpen({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...VARS, chainId: arbitrum.id });
    });

    expect(mutationFn).toHaveBeenCalledWith({ ...VARS, chainId: arbitrum.id });
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("hedger down")));

    const { result } = renderHookWithProviders(() => useInstantOpen({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARS);
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });

  it("invalidates the instant-opens feed (not the closes feed) for the active config on success", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockResolvedValue(RESULT));
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useInstantOpen({ config }), { queryClient });

    await act(async () => {
      await result.current.mutateAsync(VARS);
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const { predicate } = invalidate.mock.calls[0]![0] as { predicate: (q: Query) => boolean };
    const configKey = config.getChainConfigKey(hyperEvm.id);
    expect(predicate(queryWith(getInstantOpensQueryKey({ configKey })))).toBe(true);
    expect(predicate(queryWith(getInstantClosesQueryKey({ configKey })))).toBe(false);
  });
});
