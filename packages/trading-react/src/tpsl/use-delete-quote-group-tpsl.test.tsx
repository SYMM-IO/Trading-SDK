import type { GroupTpSlChild, QuoteTpSl, TpSlNotification } from "@symmio/trading-core";
import { PositionType } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const deleteQuoteTpSlMutationOptions = vi.hoisted(() => vi.fn());
const searchTpSlOrders = vi.hoisted(() => vi.fn());
/** Captures the accounts the run subscribes to; the socket itself never opens. */
const watchSpy = vi.hoisted(() => ({
  accounts: undefined as readonly Address[] | undefined,
}));

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, deleteQuoteTpSlMutationOptions, searchTpSlOrders };
});

vi.mock("./use-watch-tpsl-accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./use-watch-tpsl-accounts")>();
  return {
    ...actual,
    useWatchTpSlAccounts: (parameters: { accounts: readonly Address[] }) => {
      if (parameters.accounts.length > 0) watchSpy.accounts = parameters.accounts;
    },
  };
});

import { __resetTpSlStore, useTpSlStore } from "./tpsl-store";
import { useDeleteQuoteGroupTpSl } from "./use-delete-quote-group-tpsl";

const ONE = 10n ** 18n;
const VA = "0x00000000000000000000000000000000000000b1" as const;

function blankTpSl(overrides: Partial<QuoteTpSl> = {}): QuoteTpSl {
  return {
    tp: "",
    sl: "",
    tpOpenPrice: "",
    slOpenPrice: "",
    tpPriceType: "markPrice",
    slPriceType: "markPrice",
    tpState: "canceled",
    slState: "canceled",
    ...overrides,
  };
}

/** A child with both sides live at the handler. */
function makeLiveChild(key: string, quoteId: bigint, virtualAccount: Address = VA): GroupTpSlChild {
  return {
    key,
    quoteId,
    virtualAccount,
    symbolId: 7n,
    positionType: PositionType.LONG,
    openQuantity: 1n * ONE,
    openPrice: 100n * ONE,
    tpsl: blankTpSl({
      tp: "150",
      tpState: "new",
      tpCohQuoteId: `${key}-tp`,
      sl: "80",
      slState: "new",
      slCohQuoteId: `${key}-sl`,
    }),
  };
}

/**
 * The handler reports an order gone, the way any live subscription would. This
 * is the signal a cancel run waits for.
 */
function confirmGone(quoteId: number, ...sides: ("take_profit" | "stop_loss")[]): void {
  act(() => {
    for (const side of sides) {
      useTpSlStore.getState().applyNotification(BigInt(quoteId), {
        primaryIdentifier: quoteId,
        secondaryIdentifier: 0,
        quoteId,
        conditionalOrderType: side,
        state: "cancel",
        successful: true,
      } as TpSlNotification);
    }
  });
}

/** Confirm every side of every child in `quoteIds`. */
function confirmAllGone(quoteIds: number[]): void {
  for (const quoteId of quoteIds) confirmGone(quoteId, "take_profit", "stop_loss");
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  __resetTpSlStore();
  watchSpy.accounts = undefined;
  deleteQuoteTpSlMutationOptions.mockReset();
  searchTpSlOrders.mockReset();
  // A sweep that never returns is what keeps the report-driven tests honest;
  // one that resolves instantly would confirm their cancels for them.
  searchTpSlOrders.mockImplementation(() => new Promise(() => {}));
});

describe("useDeleteQuoteGroupTpSl", () => {
  it("cancels every live order using the handler id from the confirmed snapshot", async () => {
    const seen: string[] = [];
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async (variables: { cohQuoteId: string }) => {
        seen.push(variables.cohQuoteId);
        return { success: true as const };
      },
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let run!: Promise<Awaited<ReturnType<typeof result.current.deleteOrders>>>;
    act(() => {
      run = result.current.deleteOrders({ children: [makeLiveChild("a", 1n)] });
    });

    await waitFor(() => expect(seen).toEqual(["a-tp", "a-sl"]));
    confirmAllGone([1]);
    const summary = await act(async () => await run);

    expect(summary.ok).toBe(true);
    expect(summary.deletedCount).toBe(2);
    expect(summary.confirmedCount).toBe(2);
  });

  it("cancels only the scoped side", async () => {
    const seen: string[] = [];
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async (variables: { cohQuoteId: string }) => {
        seen.push(variables.cohQuoteId);
        return { success: true as const };
      },
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.deleteOrders({ children: [makeLiveChild("a", 1n)], scope: "stop_loss" });
    });

    await waitFor(() => expect(seen).toEqual(["a-sl"]));
    confirmGone(1, "stop_loss");
    await act(async () => {
      await run;
    });
  });

  it("watches the sub-account the handler reports on, then the orders' virtual accounts", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });
    const subAccount = "0x00000000000000000000000000000000000000a1" as const;

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.deleteOrders({ children: [makeLiveChild("a", 1n)], subAccount });
    });

    await waitFor(() => expect(result.current.status).toBe("confirming"));
    expect(watchSpy.accounts).toEqual([subAccount, VA]);

    confirmAllGone([1]);
    await act(async () => {
      await run;
    });
  });

  it("watches the orders' virtual accounts", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });
    const otherVa = "0x00000000000000000000000000000000000000b2" as const;
    const children = [makeLiveChild("a", 1n), makeLiveChild("b", 2n, otherVa)];

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.deleteOrders({ children });
    });

    await waitFor(() => expect(result.current.status).toBe("confirming"));
    expect(watchSpy.accounts).toEqual([VA, otherVa]);

    confirmAllGone([1, 2]);
    await act(async () => {
      await run;
    });
  });

  it("does not abandon the remaining cancels when one rejects", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async (variables: { cohQuoteId: string }) => {
        if (variables.cohQuoteId === "a-tp") throw new Error("handler rejected");
        return { success: true as const };
      },
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let run!: Promise<Awaited<ReturnType<typeof result.current.deleteOrders>>>;
    act(() => {
      run = result.current.deleteOrders({
        children: [makeLiveChild("a", 1n), makeLiveChild("b", 2n)],
      });
    });

    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmGone(1, "stop_loss");
    confirmAllGone([2]);
    const summary = await act(async () => await run);

    expect(summary.failedCount).toBe(1);
    expect(summary.confirmedCount).toBe(3);
    expect(result.current.status).toBe("partial");
  });

  it("retries only the failed cancels", async () => {
    const attempts: string[] = [];
    let failFirst = true;
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async (variables: { cohQuoteId: string }) => {
        attempts.push(variables.cohQuoteId);
        if (variables.cohQuoteId === "a-tp" && failFirst) throw new Error("handler rejected");
        return { success: true as const };
      },
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let first!: Promise<unknown>;
    act(() => {
      first = result.current.deleteOrders({ children: [makeLiveChild("a", 1n)] });
    });
    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmGone(1, "stop_loss");
    await act(async () => {
      await first;
    });

    failFirst = false;
    attempts.length = 0;

    let retry!: Promise<unknown>;
    act(() => {
      retry = result.current.retryFailed();
    });
    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmGone(1, "take_profit");
    await act(async () => {
      await retry;
    });

    expect(attempts).toEqual(["a-tp"]);
  });

  it("does not resolve until the handler reports the order gone", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let resolved = false;
    let run!: Promise<unknown>;
    act(() => {
      run = result.current
        .deleteOrders({ children: [makeLiveChild("a", 1n)], scope: "take_profit" })
        .then((summary) => {
          resolved = true;
          return summary;
        });
    });

    await waitFor(() => expect(result.current.steps[0]!.status).toBe("confirming"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBe(false);
    expect(result.current.progressPercent).toBe(0);

    confirmGone(1, "take_profit");
    await act(async () => {
      await run;
    });

    expect(result.current.steps[0]!.status).toBe("done");
    expect(result.current.status).toBe("success");
    expect(result.current.progressPercent).toBe(100);
  });

  it("confirms a cancel from the fallback sweep when no report arrives", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });
    // The handler took the cancel — `a-tp` is gone from a complete page.
    searchTpSlOrders.mockResolvedValue({ orders: [], count: 0, isComplete: true });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let summary!: Awaited<ReturnType<typeof result.current.deleteOrders>>;
    await act(async () => {
      summary = await result.current.deleteOrders({
        children: [makeLiveChild("a", 1n)],
        scope: "take_profit",
        fallbackPollDelayMs: 20,
        fallbackPollIntervalMs: 20,
      });
    });

    expect(searchTpSlOrders).toHaveBeenCalled();
    expect(summary.ok).toBe(true);
    expect(summary.confirmedCount).toBe(1);
  });

  it("does not confirm a cancel while the sweep still lists the order", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });
    // The handler accepted the request but the order is still there.
    searchTpSlOrders.mockResolvedValue({
      orders: [
        {
          quote_id: 1,
          coh_quote_id: "a-tp",
          party_a_address: VA,
          symbol_id: 7,
          conditional_order_type: "take_profit",
          quantity: 1,
          price: 100,
          conditional_order_price: 150,
          order_type: 1,
          state: "new",
          action_price_type: "markPrice",
          close_status: null,
          position_type: 0,
          leverage: null,
          create_time: 1,
          modify_time: 1,
        },
      ],
      count: 1,
      isComplete: true,
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let summary!: Awaited<ReturnType<typeof result.current.deleteOrders>>;
    await act(async () => {
      summary = await result.current.deleteOrders({
        children: [makeLiveChild("a", 1n)],
        scope: "take_profit",
        fallbackPollDelayMs: 20,
        fallbackPollIntervalMs: 20,
        confirmationTimeoutMs: 80,
      });
    });

    expect(summary.ok).toBe(false);
    expect(summary.error?.code).toBe("TPSL_CONFIRMATION_TIMEOUT");
  });

  it("gives up on a cancel the handler never reports, and says why", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let summary!: Awaited<ReturnType<typeof result.current.deleteOrders>>;
    await act(async () => {
      summary = await result.current.deleteOrders({
        children: [makeLiveChild("a", 1n)],
        scope: "take_profit",
        confirmationTimeoutMs: 20,
      });
    });

    expect(summary.ok).toBe(false);
    expect(summary.confirmedCount).toBe(0);
    expect(summary.deletedCount).toBe(1);
    expect(summary.error?.code).toBe("TPSL_CONFIRMATION_TIMEOUT");
    expect(result.current.status).toBe("failed");
  });

  it("succeeds without a request when there is nothing live to cancel", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: vi.fn(),
    });
    const child: GroupTpSlChild = { ...makeLiveChild("a", 1n), tpsl: blankTpSl() };

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let summary!: Awaited<ReturnType<typeof result.current.deleteOrders>>;
    await act(async () => {
      summary = await result.current.deleteOrders({ children: [child] });
    });

    expect(summary.ok).toBe(true);
    expect(summary.plan.isNoop).toBe(true);
    expect(result.current.status).toBe("success");
  });

  it("bounds how many cancels run at once", async () => {
    const gate = deferred();
    let peak = 0;
    let live = 0;
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => {
        live += 1;
        peak = Math.max(peak, live);
        await gate.promise;
        live -= 1;
        return { success: true as const };
      },
    });
    const children = [makeLiveChild("a", 1n), makeLiveChild("b", 2n), makeLiveChild("c", 3n)];

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.deleteOrders({ children, concurrency: 2 });
    });

    await waitFor(() => expect(peak).toBe(2));
    gate.resolve();
    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmAllGone([1, 2, 3]);
    await act(async () => {
      await run;
    });
    // Six orders total, never more than two in flight.
    expect(peak).toBe(2);
  });
});
