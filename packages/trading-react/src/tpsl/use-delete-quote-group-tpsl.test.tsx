import type { GroupTpSlChild, QuoteTpSl, TpSlNotification } from "@symmio/trading-core";
import { PositionType } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const deleteQuoteTpSlMutationOptions = vi.hoisted(() => vi.fn());
const watchSpy = vi.hoisted(() => ({
  params: undefined as { onNotification?: (notification: TpSlNotification) => void; enabled?: boolean } | undefined,
}));

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, deleteQuoteTpSlMutationOptions };
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
function makeLiveChild(key: string, quoteId: bigint): GroupTpSlChild {
  return {
    key,
    quoteId,
    virtualAccount: VA,
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
  deleteQuoteTpSlMutationOptions.mockReset();
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

    let summary!: Awaited<ReturnType<typeof result.current.deleteOrders>>;
    await act(async () => {
      summary = await result.current.deleteOrders({ children: [makeLiveChild("a", 1n)] });
    });

    expect(seen).toEqual(["a-tp", "a-sl"]);
    expect(summary.ok).toBe(true);
    expect(summary.deletedCount).toBe(2);
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

    await act(async () => {
      await result.current.deleteOrders({ children: [makeLiveChild("a", 1n)], scope: "stop_loss" });
    });

    expect(seen).toEqual(["a-sl"]);
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

    let summary!: Awaited<ReturnType<typeof result.current.deleteOrders>>;
    await act(async () => {
      summary = await result.current.deleteOrders({
        children: [makeLiveChild("a", 1n), makeLiveChild("b", 2n)],
      });
    });

    expect(summary.failedCount).toBe(1);
    expect(summary.deletedCount).toBe(3);
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

    await act(async () => {
      await result.current.deleteOrders({ children: [makeLiveChild("a", 1n)] });
    });
    failFirst = false;
    attempts.length = 0;

    await act(async () => {
      await result.current.retryFailed();
    });

    expect(attempts).toEqual(["a-tp"]);
  });

  it("flips a cancel to done on the handler's report", async () => {
    deleteQuoteTpSlMutationOptions.mockReturnValue({
      mutationKey: ["deleteQuoteTpSl"],
      mutationFn: async () => ({ success: true as const }),
    });

    const { result } = renderHookWithProviders(() =>
      useDeleteQuoteGroupTpSl({ config: createMockSymmioConfig().config }),
    );

    await act(async () => {
      await result.current.deleteOrders({ children: [makeLiveChild("a", 1n)], scope: "take_profit" });
    });
    expect(result.current.steps[0]!.status).toBe("confirming");

    act(() => {
      watchSpy.params?.onNotification?.({
        primaryIdentifier: 1,
        secondaryIdentifier: 0,
        quoteId: 1,
        conditionalOrderType: "take_profit",
        state: "cancel",
        successful: true,
      } as TpSlNotification);
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.steps[0]!.status).toBe("done");
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
    await act(async () => {
      gate.resolve();
      await run;
    });
    // Six orders total, never more than two in flight.
    expect(peak).toBe(2);
  });
});
