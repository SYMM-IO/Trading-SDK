import type { GroupTpSlChild, QuoteTpSl, TpSlNotification } from "@symmio/trading-core";
import { PositionType } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { UserRejectedRequestError } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const setQuoteTpSlMutationOptions = vi.hoisted(() => vi.fn());
const deleteQuoteTpSlMutationOptions = vi.hoisted(() => vi.fn());
/** Captures the live `useWatchTpSlNotifications` params so tests can fire frames. */
const watchSpy = vi.hoisted(() => ({
  params: undefined as { onNotification?: (notification: TpSlNotification) => void; enabled?: boolean } | undefined,
}));

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, setQuoteTpSlMutationOptions, deleteQuoteTpSlMutationOptions };
});

vi.mock("./use-watch-tpsl-notifications", () => ({
  useWatchTpSlNotifications: (parameters: {
    onNotification?: (notification: TpSlNotification) => void;
    enabled?: boolean;
  }) => {
    watchSpy.params = parameters;
    return { status: "open", error: null };
  },
}));

import { __resetTpSlStore } from "./tpsl-store";
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

function makeChild(key: string, quoteId: bigint, tpsl: QuoteTpSl = blankTpSl()): GroupTpSlChild {
  return {
    key,
    quoteId,
    virtualAccount: VA,
    symbolId: 7n,
    positionType: PositionType.LONG,
    openQuantity: 1n * ONE,
    openPrice: 100n * ONE,
    tpsl,
  };
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
  watchSpy.params = undefined;
  setQuoteTpSlMutationOptions.mockReset();
  deleteQuoteTpSlMutationOptions.mockReset();
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

    await act(async () => {
      await result.current.set({
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

    expect(order).toEqual([1n, 2n, 3n]);
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

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    expect(seen).toEqual([2n]);
    expect(summary.skippedCount).toBe(1);
    expect(summary.steps.find((step) => step.key === "a")?.skipReason).toBe("unchanged");
  });

  it("seeds the shared store so the target price shows while confirming", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const, cohQuoteId: "coh-1" }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    await act(async () => {
      await result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    const { useTpSlStore } = await import("./tpsl-store");
    const record = useTpSlStore.getState().get(1n);
    expect(record?.tp).toBe("150.00");
    expect(record?.tpState).toBe("confirming");
    expect(record?.tpCohQuoteId).toBe("coh-1");
    expect(result.current.status).toBe("confirming");
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

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "150" } }, b: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    expect(summary.ok).toBe(false);
    expect(summary.failedCount).toBe(1);
    expect(summary.submittedCount).toBe(1);
    // The surviving leg is still awaiting its report, so the run is not terminal yet.
    expect(result.current.status).toBe("confirming");

    act(() => {
      watchSpy.params?.onNotification?.(report(2, "take_profit"));
    });
    await waitFor(() => expect(result.current.status).toBe("partial"));
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

    await act(async () => {
      await result.current.set({ children, desired, subAccount: SUB_ACCOUNT, pricePrecision: 2 });
    });
    failFirst = false;
    attempts.length = 0;

    await act(async () => {
      await result.current.retryFailed();
    });

    expect(attempts).toEqual([1n]);
    expect(result.current.status).toBe("confirming");
  });

  it("flips a confirming child to done when the handler reports it live", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    await act(async () => {
      await result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });
    expect(result.current.steps[0]!.status).toBe("confirming");

    act(() => {
      watchSpy.params?.onNotification?.(report(1, "take_profit"));
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.steps[0]!.status).toBe("done");
  });

  it("waits for both sides before marking a two-sided child done", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    await act(async () => {
      await result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" }, sl: { triggerPrice: "80" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });
    expect(result.current.steps[0]!.sides).toEqual(["take_profit", "stop_loss"]);

    act(() => {
      watchSpy.params?.onNotification?.(report(1, "take_profit"));
    });
    expect(result.current.steps[0]!.status).toBe("confirming");

    act(() => {
      watchSpy.params?.onNotification?.(report(1, "stop_loss"));
    });
    await waitFor(() => expect(result.current.steps[0]!.status).toBe("done"));
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

    await act(async () => {
      gate.resolve();
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
    await act(async () => {
      gate.resolve();
      await run;
    });
  });
});

describe("useSetQuoteGroupTpSl · store-driven confirmation", () => {
  it("resolves a confirming step from a store update alone (frame on another subscription)", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const, cohQuoteId: "coh-1" }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    await act(async () => {
      await result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });
    expect(result.current.steps[0]!.status).toBe("confirming");

    // Simulate the READ hook's subscription landing the frame into the shared
    // store — this hook's own `watchSpy` is never fired.
    const { useTpSlStore } = await import("./tpsl-store");
    act(() => {
      useTpSlStore.getState().applyNotification(1n, report(1, "take_profit"));
    });

    await waitFor(() => expect(result.current.steps[0]!.status).toBe("done"));
    expect(result.current.status).toBe("success");
  });

  it("resolves a two-sided step only once both sides settle in the store", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    await act(async () => {
      await result.current.set({
        children: [makeChild("a", 1n)],
        desired: { a: { tp: { triggerPrice: "150" }, sl: { triggerPrice: "80" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    const { useTpSlStore } = await import("./tpsl-store");
    act(() => {
      useTpSlStore.getState().applyNotification(1n, report(1, "take_profit"));
    });
    expect(result.current.steps[0]!.status).toBe("confirming");

    act(() => {
      useTpSlStore.getState().applyNotification(1n, report(1, "stop_loss"));
    });
    await waitFor(() => expect(result.current.steps[0]!.status).toBe("done"));
  });
});

describe("useSetQuoteGroupTpSl · invalidation", () => {
  it("completes a successful run with invalidation wired (no throw)", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["setQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });
    const children = [makeChild("a", 1n)];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "150" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    expect(summary.ok).toBe(true);
    expect(result.current.status).toBe("confirming");
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

    let summary!: Awaited<ReturnType<typeof result.current.set>>;
    await act(async () => {
      summary = await result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    expect(cancelled).toEqual(["coh-1"]);
    expect(summary.submittedCount).toBe(1);
    expect(result.current.steps[0]).toMatchObject({ kind: "cancel", status: "confirming" });
    expect(result.current.status).toBe("confirming");
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

    await act(async () => {
      await result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "" }, sl: { triggerPrice: "80" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    expect(order).toEqual(["cancel", "write"]);
    expect(result.current.steps.map((step) => step.kind)).toEqual(["cancel", "write"]);
  });

  it("confirms a cancel only on a gone report, not on a new-order report", async () => {
    setQuoteTpSlMutationOptions.mockReturnValue({ mutationKey: ["setQuoteTpSl"], mutationFn: vi.fn() });
    const children = [makeChild("a", 1n, blankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "coh-1" }))];

    const { result } = renderHookWithProviders(() => useSetQuoteGroupTpSl({ config: createMockSymmioConfig().config }));

    await act(async () => {
      await result.current.set({
        children,
        desired: { a: { tp: { triggerPrice: "" } } },
        subAccount: SUB_ACCOUNT,
        pricePrecision: 2,
      });
    });

    // A "new" report belongs to a write, never to a cancel.
    act(() => {
      watchSpy.params?.onNotification?.(report(1, "take_profit"));
    });
    expect(result.current.steps[0]!.status).toBe("confirming");

    act(() => {
      watchSpy.params?.onNotification?.({ ...report(1, "take_profit"), state: "canceled" } as TpSlNotification);
    });
    await waitFor(() => expect(result.current.steps[0]!.status).toBe("done"));
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

    await act(async () => {
      await result.current.set({ children, desired, subAccount: SUB_ACCOUNT, pricePrecision: 2, concurrency: 2 });
    });
    expect(result.current.status).toBe("confirming");
    // Leg A confirms before the retry runs.
    act(() => {
      watchSpy.params?.onNotification?.(report(1, "take_profit"));
    });
    await waitFor(() => expect(result.current.steps.find((s) => s.key === "a")?.status).toBe("done"));

    failB = false;
    await act(async () => {
      await result.current.retryFailed();
    });

    // A's success survived the retry rather than being reset to queued.
    expect(result.current.steps.find((step) => step.key === "a")?.status).toBe("done");
    expect(result.current.steps.find((step) => step.key === "b")?.status).toBe("confirming");
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
    expect(result.current.failedCount).toBe(2);
    expect(result.current.progressPercent).toBe(100);
  });
});
