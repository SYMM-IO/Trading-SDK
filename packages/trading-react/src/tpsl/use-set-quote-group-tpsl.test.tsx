import type { GroupTpSlChild, QuoteTpSl, TpSlNotification } from "@symmio/trading-core";
import { PositionType } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { UserRejectedRequestError } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const setQuoteTpSlMutationOptions = vi.hoisted(() => vi.fn());
const deleteQuoteTpSlMutationOptions = vi.hoisted(() => vi.fn());
const searchTpSlOrders = vi.hoisted(() => vi.fn());
/** Captures the accounts the run subscribes to; the socket itself never opens. */
const watchSpy = vi.hoisted(() => ({
  accounts: undefined as readonly Address[] | undefined,
  enabled: undefined as boolean | undefined,
}));

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, setQuoteTpSlMutationOptions, deleteQuoteTpSlMutationOptions, searchTpSlOrders };
});

vi.mock("./use-watch-tpsl-accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./use-watch-tpsl-accounts")>();
  return {
    ...actual,
    useWatchTpSlAccounts: (parameters: { accounts: readonly Address[]; enabled?: boolean }) => {
      if (parameters.accounts.length > 0) watchSpy.accounts = parameters.accounts;
      watchSpy.enabled = parameters.enabled;
    },
  };
});

import { __resetTpSlStore, useTpSlStore } from "./tpsl-store";
import { useSetQuoteGroupTpSl } from "./use-set-quote-group-tpsl";

const ONE = 10n ** 18n;
const SUB_ACCOUNT = "0x00000000000000000000000000000000000000a1" as const;
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

function makeChild(key: string, quoteId: bigint, tpsl: QuoteTpSl = blankTpSl(), virtualAccount: Address = VA) {
  return {
    key,
    quoteId,
    virtualAccount,
    symbolId: 7n,
    positionType: PositionType.LONG,
    openQuantity: 1n * ONE,
    openPrice: 100n * ONE,
    tpsl,
  } satisfies GroupTpSlChild;
}

/** A successful handler report for one side of one quote. */
function report(quoteId: number, side: "take_profit" | "stop_loss"): TpSlNotification {
  return {
    primaryIdentifier: quoteId,
    secondaryIdentifier: 0,
    quoteId,
    conditionalOrderType: side,
    state: "new",
    successful: true,
  } as TpSlNotification;
}

/**
 * Land a handler report in the shared store, the way any live subscription
 * would. This is the signal a run waits for.
 */
function confirmLive(quoteId: number, ...sides: ("take_profit" | "stop_loss")[]): void {
  act(() => {
    for (const side of sides) useTpSlStore.getState().applyNotification(BigInt(quoteId), report(quoteId, side));
  });
}

/** The counterpart for a cancel: the handler reports the order gone. */
function confirmGone(quoteId: number, ...sides: ("take_profit" | "stop_loss")[]): void {
  act(() => {
    for (const side of sides) {
      useTpSlStore
        .getState()
        .applyNotification(BigInt(quoteId), { ...report(quoteId, side), state: "canceled" } as TpSlNotification);
    }
  });
}

/** A deferred promise, for asserting on in-flight ordering. */
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
  watchSpy.enabled = undefined;
  setQuoteTpSlMutationOptions.mockReset();
  deleteQuoteTpSlMutationOptions.mockReset();
  searchTpSlOrders.mockReset();
  // The sweep finds nothing unless a test says otherwise, so the existing
  // report-driven tests keep exercising the WebSocket path.
  searchTpSlOrders.mockResolvedValue({ orders: [], count: 0, isComplete: true });
  deleteQuoteTpSlMutationOptions.mockReturnValue({
    mutationKey: ["deleteQuoteTpSl"],
    mutationFn: async () => ({ success: true as const }),
  });
});

describe("useSetQuoteGroupTpSl", () => {
  it("submits one request per child, sequentially", async () => {
    const order: bigint[] = [];
    const inFlight: bigint[] = [];
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async (variables: { quoteId: bigint }) => {
        order.push(variables.quoteId);
        inFlight.push(variables.quoteId);
        await Promise.resolve();
        expect(inFlight).toHaveLength(1);
        inFlight.pop();
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n), makeChild("b", 2n), makeChild("c", 3n)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children,
        desired: {
          a: { tp: { triggerPrice: "150" } },
          b: { tp: { triggerPrice: "150" } },
          c: { tp: { triggerPrice: "150" } },
        },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    await waitFor(() => expect(order).toEqual([1n, 2n, 3n]));
    confirmLive(1, "take_profit");
    confirmLive(2, "take_profit");
    confirmLive(3, "take_profit");
    await act(async () => {
      await run;
    });
  });

  it("never sends a request for an unchanged child", async () => {
    const seen: bigint[] = [];
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async (variables: { quoteId: bigint }) => {
        seen.push(variables.quoteId);
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n, blankTpSl({ tp: "150.00", tpState: "new" })), makeChild("b", 2n)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<Awaited<ReturnType<typeof result.current.set>>>;
    act(() => {
      run = result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    await waitFor(() => expect(seen).toEqual([2n]));
    confirmLive(2, "take_profit");
    const summary = await act(async () => await run);

    expect(summary.skippedCount).toBe(1);
    expect(summary.steps.find((step) => step.key === "a")?.skipReason).toBe("unchanged");
  });

  it("seeds the shared store so the target price shows while confirming", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const, cohQuoteId: "coh-1" }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    await waitFor(() => expect(result.current.status).toBe("confirming"));
    const record = useTpSlStore.getState().get(1n);
    expect(record?.tp).toBe("150.00");
    expect(record?.tpState).toBe("confirming");
    expect(record?.tpCohQuoteId).toBe("coh-1");
    expect(result.current.isConfirming).toBe(true);

    confirmLive(1, "take_profit");
    await act(async () => {
      await run;
    });
  });

  it("watches the legs' virtual accounts, not the sub-account", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });
    const otherVa = "0x00000000000000000000000000000000000000b2" as const;
    const children = [makeChild("a", 1n), makeChild("b", 2n, blankTpSl(), otherVa)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    await waitFor(() => expect(result.current.status).toBe("confirming"));
    // A group can span Virtual Accounts, and the handler reports on the VA —
    // subscribing to the sub-account would hear nothing at all.
    expect(watchSpy.accounts).toEqual([VA, otherVa]);
    expect(watchSpy.enabled).toBe(true);

    confirmLive(1, "take_profit");
    confirmLive(2, "take_profit");
    await act(async () => {
      await run;
    });
  });

  it("keeps going after one child fails and reports partial", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async (variables: { quoteId: bigint }) => {
        if (variables.quoteId === 1n) throw new Error("handler rejected");
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n), makeChild("b", 2n)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<Awaited<ReturnType<typeof result.current.set>>>;
    act(() => {
      run = result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    // The surviving leg is still awaiting its report, so the run is not terminal
    // yet even though one leg has already failed.
    await waitFor(() => expect(result.current.status).toBe("confirming"));

    confirmLive(2, "take_profit");
    const summary = await act(async () => await run);

    expect(summary.ok).toBe(false);
    expect(summary.failedCount).toBe(1);
    expect(summary.confirmedCount).toBe(1);
    expect(result.current.status).toBe("partial");
  });

  it("retries only the children that failed", async () => {
    const attempts: bigint[] = [];
    let failFirst = true;
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async (variables: { quoteId: bigint }) => {
        attempts.push(variables.quoteId);
        if (variables.quoteId === 1n && failFirst) throw new Error("handler rejected");
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n), makeChild("b", 2n)];
    const desired = { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } };

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let first!: Promise<unknown>;
    act(() => {
      first = result.current.set({ children, desired, subAccount: SUB_ACCOUNT, pricePrecision: 2 });
    });
    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmLive(2, "take_profit");
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
    confirmLive(1, "take_profit");
    await act(async () => {
      await retry;
    });

    expect(attempts).toEqual([1n]);
    expect(result.current.status).toBe("success");
  });

  it("flips a confirming child to done when the handler reports it live", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });
    await waitFor(() => expect(result.current.steps[0]!.status).toBe("confirming"));

    confirmLive(1, "take_profit");
    await act(async () => {
      await run;
    });

    expect(result.current.steps[0]!.status).toBe("done");
    expect(result.current.status).toBe("success");
  });

  it("waits for both sides before marking a two-sided child done", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" }, sl: { triggerPrice: "80" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });
    await waitFor(() => expect(result.current.steps[0]!.status).toBe("confirming"));
    expect(result.current.steps[0]!.sides).toEqual(["take_profit", "stop_loss"]);

    confirmLive(1, "take_profit");
    expect(result.current.steps[0]!.status).toBe("confirming");
    expect(result.current.steps[0]!.sides).toEqual(["stop_loss"]);

    confirmLive(1, "stop_loss");
    await act(async () => {
      await run;
    });
    expect(result.current.steps[0]!.status).toBe("done");
  });

  it("refuses a second run while one is in flight", async () => {
    const gate = deferred();
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => {
        await gate.promise;
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n)];
    const desired = { a: { tp: { triggerPrice: "150" } } };

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let first!: Promise<Awaited<ReturnType<typeof result.current.set>>>;
    act(() => {
      first = result.current.set({ children, desired, subAccount: SUB_ACCOUNT, pricePrecision: 2 });
    });

    const second = await result.current.set({ children, desired, subAccount: SUB_ACCOUNT, pricePrecision: 2 });
    expect(second.ok).toBe(false);
    expect(second.error?.message).toMatch(/already in flight/);

    gate.resolve();
    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmLive(1, "take_profit");
    await act(async () => {
      await first;
    });
  });

  it("succeeds without any request when the plan is a no-op", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: vi.fn(),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children: [makeChild("a", 1n, blankTpSl({ tp: "150.00", tpState: "new" }))],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    expect(summary.ok).toBe(true);
    expect(summary.submittedCount).toBe(0);
    expect(result.current.status).toBe("success");
  });

  it("skips an invalid child instead of submitting it", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: vi.fn(),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children: [makeChild("a", 1n)],
        // A LONG take-profit below the mark price is the wrong direction.
        desired: { a: { tp: { triggerPrice: "50" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
        referencePrice: "100",
        config: { minPriceDistancePercent: 0.1, minProfitStopLossSpreadPercent: 0.1 },
      });
    });

    expect(summary.plan.hasInvalid).toBe(true);
    expect(summary.submittedCount).toBe(0);
    expect(summary.steps[0]!.skipReason).toBe("invalid");
  });

  it("runs children in parallel when concurrency is raised", async () => {
    const gate = deferred();
    let peak = 0;
    let live = 0;
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => {
        live += 1;
        peak = Math.max(peak, live);
        await gate.promise;
        live -= 1;
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n), makeChild("b", 2n), makeChild("c", 3n)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children,
        desired: {
          a: { tp: { triggerPrice: "150" } },
          b: { tp: { triggerPrice: "150" } },
          c: { tp: { triggerPrice: "150" } },
        },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
        concurrency: 3,
      });
    });

    await waitFor(() => expect(peak).toBe(3));
    gate.resolve();
    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmLive(1, "take_profit");
    confirmLive(2, "take_profit");
    confirmLive(3, "take_profit");
    await act(async () => {
      await run;
    });
  });
});

describe("useSetQuoteGroupTpSl · confirmation", () => {
  it("does not resolve until the handler reports the order live", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let resolved = false;
    let run!: Promise<unknown>;
    act(() => {
      run = result.current
        .set({
          children: [makeChild("a", 1n)],
          desired: { a: { tp: { triggerPrice: "150" } } },
          subAccount: SUB_ACCOUNT,
          pricePrecision: 2,
        })
        .then((summary) => {
          resolved = true;
          return summary;
        });
    });

    await waitFor(() => expect(result.current.status).toBe("confirming"));
    // The request was accepted a while ago; that is not confirmation.
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBe(false);
    expect(result.current.progressPercent).toBe(0);

    confirmLive(1, "take_profit");
    await act(async () => {
      await run;
    });
    expect(resolved).toBe(true);
    expect(result.current.progressPercent).toBe(100);
  });

  it("resolves a confirming step from a store update alone (frame on another subscription)", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const, cohQuoteId: "coh-1" }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });
    await waitFor(() => expect(result.current.steps[0]!.status).toBe("confirming"));

    // The READ hook's subscription lands the frame in the shared store; this
    // hook's own watcher never fires.
    confirmLive(1, "take_profit");
    await act(async () => {
      await run;
    });

    expect(result.current.steps[0]!.status).toBe("done");
    expect(result.current.status).toBe("success");
  });

  it("confirms from the fallback sweep when no report ever arrives", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const, cohQuoteId: "coh-1" }),
    });
    // The handler took the order and shows it — it just never said so on the socket.
    searchTpSlOrders.mockResolvedValue({
      orders: [
        {
          quote_id: 1,
          coh_quote_id: "coh-1",
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

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
        fallbackPollDelayMs: 20,
        fallbackPollIntervalMs: 20,
      });
    });

    expect(searchTpSlOrders).toHaveBeenCalled();
    expect(searchTpSlOrders.mock.calls[0]![1]).toMatchObject({ account: VA });
    expect(summary.ok).toBe(true);
    expect(summary.confirmedCount).toBe(1);
    expect(result.current.status).toBe("success");
  });

  it("does not let the sweep confirm a write the handler never took", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const, cohQuoteId: "coh-new" }),
    });
    // The account has an order, but it is the pre-edit one this run replaced.
    searchTpSlOrders.mockResolvedValue({
      orders: [
        {
          quote_id: 1,
          coh_quote_id: "coh-old",
          party_a_address: VA,
          symbol_id: 7,
          conditional_order_type: "take_profit",
          quantity: 1,
          price: 100,
          conditional_order_price: 140,
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

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children: [makeChild("a", 1n, blankTpSl({ tp: "140", tpState: "new", tpCohQuoteId: "coh-old" }))],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
        fallbackPollDelayMs: 20,
        fallbackPollIntervalMs: 20,
        confirmationTimeoutMs: 80,
      });
    });

    expect(summary.ok).toBe(false);
    expect(summary.error?.code).toBe("TPSL_CONFIRMATION_TIMEOUT");
  });

  it("gives up on a step the handler never reports, and says why", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
        confirmationTimeoutMs: 20,
      });
    });

    expect(summary.ok).toBe(false);
    expect(summary.confirmedCount).toBe(0);
    // It reached the handler — "accepted but unconfirmed" is not "rejected".
    expect(summary.submittedCount).toBe(1);
    expect(summary.error?.code).toBe("TPSL_CONFIRMATION_TIMEOUT");
    expect(result.current.status).toBe("failed");
    // The store stops holding the side, so the handler's rows decide from here.
    expect(useTpSlStore.getState().get(1n)?.tpConfirm).toBeUndefined();
  });
});

describe("useSetQuoteGroupTpSl · cancels", () => {
  it("executes a clear as a real cancel instead of reporting an empty success", async () => {
    const cancelled: string[] = [];
    setQuoteTpSlMutationOptions.mockReturnValue({ mutationKey: ["setQuoteTpSl"], mutationFn: vi.fn() });
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async (variables: { cohQuoteId: string }) => {
        cancelled.push(variables.cohQuoteId);
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n, blankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }))];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<Awaited<ReturnType<typeof result.current.set>>>;
    act(() => {
      run = result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    await waitFor(() => expect(result.current.steps[0]).toMatchObject({ kind: "cancel", status: "confirming" }));
    expect(cancelled).toEqual(["coh-1"]);

    confirmGone(1, "take_profit");
    const summary = await act(async () => await run);

    expect(summary.confirmedCount).toBe(1);
    expect(result.current.status).toBe("success");
  });

  it("cancels one side and writes the other for the same leg in one run", async () => {
    const order: string[] = [];
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => {
        order.push("write");
        return { success: true as const };
      },
    });
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => {
        order.push("cancel");
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n, blankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }))];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "" }, sl: { triggerPrice: "80" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    await waitFor(() => expect(order).toEqual(["cancel", "write"]));
    expect(result.current.steps.map((step) => step.kind)).toEqual(["cancel", "write"]);

    confirmGone(1, "take_profit");
    confirmLive(1, "stop_loss");
    await act(async () => {
      await run;
    });
    expect(result.current.status).toBe("success");
  });

  it("confirms a cancel only on a gone report, not on a new-order report", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({ mutationKey: ["setQuoteTpSl"], mutationFn: vi.fn() });
    const children = [makeChild("a", 1n, blankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }))];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let run!: Promise<unknown>;
    act(() => {
      run = result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });
    await waitFor(() => expect(result.current.steps[0]!.status).toBe("confirming"));

    // A "new" report belongs to a write, never to a cancel.
    confirmLive(1, "take_profit");
    expect(result.current.steps[0]!.status).toBe("confirming");

    confirmGone(1, "take_profit");
    await act(async () => {
      await run;
    });
    expect(result.current.steps[0]!.status).toBe("done");
    expect(result.current.status).toBe("success");
  });

  it("stops the run when the wallet rejects a signature", async () => {
    let attempts = 0;
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => {
        attempts += 1;
        throw new UserRejectedRequestError(new Error("User rejected the request."));
      },
    });
    const children = [makeChild("a", 1n), makeChild("b", 2n), makeChild("c", 3n)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children,
        desired: {
          a: { tp: { triggerPrice: "150" } },
          b: { tp: { triggerPrice: "150" } },
          c: { tp: { triggerPrice: "150" } },
        },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    expect(attempts).toBe(1);
    expect(summary.stoppedByUser).toBe(true);
    expect(summary.failedCount).toBe(3);
    expect(result.current.status).toBe("failed");
  });

  it("keeps already-confirmed steps when retrying the failed ones", async () => {
    let failB = true;
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async (variables: { quoteId: bigint }) => {
        if (variables.quoteId === 2n && failB) throw new Error("handler rejected");
        return { success: true as const };
      },
    });
    const children = [makeChild("a", 1n), makeChild("b", 2n)];
    const desired = { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } };

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let first!: Promise<unknown>;
    act(() => {
      first = result.current.set({ children, desired, subAccount: SUB_ACCOUNT, pricePrecision: 2, concurrency: 2 });
    });
    await waitFor(() => expect(result.current.status).toBe("confirming"));
    confirmLive(1, "take_profit");
    await act(async () => {
      await first;
    });
    expect(result.current.steps.find((step) => step.key === "a")?.status).toBe("done");

    failB = false;
    let retry!: Promise<unknown>;
    act(() => {
      retry = result.current.retryFailed();
    });
    await waitFor(() => expect(result.current.steps.find((step) => step.key === "b")?.status).toBe("confirming"));
    confirmLive(2, "take_profit");
    await act(async () => {
      await retry;
    });

    // A's success survived the retry rather than being reset to queued.
    expect(result.current.steps.find((step) => step.key === "a")?.status).toBe("done");
    expect(result.current.steps.find((step) => step.key === "b")?.status).toBe("done");
  });

  it("does not count failures as accepted work", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => {
        throw new Error("handler rejected");
      },
    });
    const children = [makeChild("a", 1n), makeChild("b", 2n)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    await act(async () => {
      await result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
        stopOnUserRejection: false,
      });
    });

    expect(result.current.acceptedCount).toBe(0);
    expect(result.current.confirmedCount).toBe(0);
    expect(result.current.failedCount).toBe(2);
    expect(result.current.progressPercent).toBe(100);
  });
});
