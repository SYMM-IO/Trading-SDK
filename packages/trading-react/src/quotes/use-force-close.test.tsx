import {
  getPartyAOpenPositionsQueryKey,
  getQuotePendingFundingQueryKey,
  SymmioSupportedChainId,
  type ForceCloseAutoParameters,
} from "@symmio/trading-core";
import type { Query, QueryKey } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockSymmioConfig,
  createTestQueryClient,
  renderHookWithProviders,
  TEST_TX_HASH,
} from "../test/test-utils";

const forceCloseAutoMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, forceCloseAutoMutationOptions };
});

import { useForceClose } from "./use-force-close";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VARS: ForceCloseAutoParameters = { account: SUB_ACCOUNT, quoteId: 42n };

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  forceCloseAutoMutationOptions.mockReturnValue({ mutationKey: ["forceCloseAuto"], mutationFn });
}

describe("useForceClose", () => {
  afterEach(() => forceCloseAutoMutationOptions.mockReset());

  it("runs the auto flow and returns the tx hash when waitForReceipt is false", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(TEST_TX_HASH);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useForceClose({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(mutationFn).toHaveBeenCalledWith(expect.objectContaining({ account: SUB_ACCOUNT, quoteId: 42n }));
  });

  it("normalizes a rejected flow (e.g. price not reached) to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("price not reached")));

    const { result } = renderHookWithProviders(() => useForceClose({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARS);
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("unknown");
  });

  it("invalidates the open positions and the chain's pending-funding reads after the receipt", async () => {
    const { config, waitForTransactionReceipt } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockResolvedValue(TEST_TX_HASH));
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useForceClose({ config }), { queryClient });

    await act(async () => {
      await result.current.mutateAsync(VARS);
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
    const configKey = config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM);
    /** Run every predicate the mutation handed to `invalidateQueries` against one key. */
    const matches = (key: QueryKey) =>
      invalidate.mock.calls.some(([filters]) => {
        const { predicate } = filters as { predicate: (q: Query) => boolean };
        return predicate({ queryKey: key } as Query<unknown, Error, unknown, QueryKey>);
      });

    /** The row's status moves, so the owning partyA's open positions are re-read… */
    expect(matches(getPartyAOpenPositionsQueryKey({ configKey, partyA: SUB_ACCOUNT }))).toBe(true);
    /** …and the close settles the accrued funding, so every pending-funding read on the chain is stale. */
    expect(matches(getQuotePendingFundingQueryKey({ configKey, quoteIds: [VARS.quoteId] }))).toBe(true);
    /** Another chain config's pending funding must survive. */
    expect(matches(getQuotePendingFundingQueryKey({ configKey: "other", quoteIds: [VARS.quoteId] }))).toBe(false);
  });
});
