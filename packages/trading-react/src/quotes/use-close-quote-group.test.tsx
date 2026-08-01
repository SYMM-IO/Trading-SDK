import type { Notification, QuoteGroup, UnifiedQuote } from "@symmio/trading-core";
import { NotificationType, OrderType, PositionType, QuoteLifecycle, QuoteStatus } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const instantCloseBulkAutoMutationOptions = vi.hoisted(() => vi.fn());
/** Captures the latest `useNotifications` params so tests can fire frames manually. */
const notificationsSpy = vi.hoisted(() => ({
  params: undefined as { onNotification?: (notification: Notification) => void; enabled?: boolean } | undefined,
}));

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, instantCloseBulkAutoMutationOptions };
});

vi.mock("../websocket/use-notifications", () => ({
  useNotifications: (parameters: { onNotification?: (notification: Notification) => void; enabled?: boolean }) => {
    notificationsSpy.params = parameters;
    return { notifications: [], status: "idle" };
  },
}));

import { useCloseQuoteGroup } from "./use-close-quote-group";

const ONE = 10n ** 18n;
const PARTY_A = "0x00000000000000000000000000000000000000a1" as const;
const VA = "0x00000000000000000000000000000000000000b2" as const;

/** Fire one notification frame for a quote id, as the WS would. */
function fireNotification(
  quoteId: bigint,
  frame: Partial<Pick<Notification, "type" | "lastSeenAction" | "failureMessage">> = {},
) {
  notificationsSpy.params?.onNotification?.({
    quoteId: String(quoteId),
    type: NotificationType.SUCCESS,
    lastSeenAction: "FillMarketOrderInstantClose",
    ...frame,
  } as Notification);
}

function makeChild(overrides: Partial<UnifiedQuote> & { key: string }): UnifiedQuote {
  const base: UnifiedQuote = {
    key: overrides.key,
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 1n,
    partyA: PARTY_A,
    vaAddress: VA,
    symbolId: 7n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    quoteStatus: QuoteStatus.OPENED,
    requestedOpenPrice: 100n * ONE,
    quantity: 1n * ONE,
    closedAmount: 0n,
    openQuantity: 1n * ONE,
    lockedValues: { cva: 50n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 0n },
    raw: {},
  };
  const merged = { ...base, ...overrides };
  if (overrides.openQuantity === undefined) merged.openQuantity = merged.quantity - (merged.closedAmount ?? 0n);
  return merged;
}

function makeGroup(quotes: UnifiedQuote[]): QuoteGroup {
  return {
    key: "group:7",
    by: { symbolId: 7n },
    vaAddress: VA,
    quotes,
    isAggregate: quotes.length > 1,
    metrics: {
      quoteCount: quotes.length,
      openCount: quotes.length,
      pendingCount: 0,
      quantity: quotes.reduce((sum, quote) => sum + quote.quantity, 0n),
      openQuantity: quotes.reduce((sum, quote) => sum + quote.openQuantity, 0n),
      weightedOpenPrice: undefined,
      initialNotional: 0n,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
      leverage: undefined,
    },
  };
}

// lockedForPartyA = 100 per 1.0 open → minRemain = open × MAQV / 100.
const MAQV = 10n * ONE;

describe("useCloseQuoteGroup", () => {
  it("submits all children in one bulk request, then confirms each on its close-fill notification", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue({ success: true });
    instantCloseBulkAutoMutationOptions.mockReturnValue({ mutationKey: ["instantCloseBulkAuto"], mutationFn });

    const big = makeChild({ key: "onchain:1", quoteId: 1n, quantity: 3n * ONE });
    const small = makeChild({ key: "onchain:2", quoteId: 2n, quantity: 2n * ONE });
    const { result } = renderHookWithProviders(() => useCloseQuoteGroup({ config }));

    let summary: Awaited<ReturnType<typeof result.current.close>> | undefined;
    await act(async () => {
      summary = await result.current.close({
        group: makeGroup([big, small]),
        targetQuantity: 4n * ONE,
        minAcceptableQuoteValue: MAQV,
        slippage: 5,
      });
    });

    // Submission done — nothing confirmed yet.
    expect(summary!.ok).toBe(true);
    expect(summary!.closedQuantity).toBe(0n);
    // One endpoint call carrying every operation — never one call per quote.
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(mutationFn.mock.calls[0]![0]).toMatchObject({
      orders: [
        { partyA: VA, quoteId: 1n, quantityToClose: "3", market: { id: 7 }, slippage: 5 },
        { partyA: VA, quoteId: 2n, quantityToClose: "1", market: { id: 7 }, slippage: 5 },
      ],
    });
    expect(result.current.status).toBe("closing");
    expect(result.current.steps.map((step) => step.status)).toEqual(["closing", "closing"]);
    expect(result.current.progressPercent).toBe(0);

    // Request-stage frames do NOT complete anything.
    act(() => {
      fireNotification(1n, { lastSeenAction: "InstantRequestToClosePosition" });
      fireNotification(2n, { type: NotificationType.SEEN });
    });
    expect(result.current.steps.map((step) => step.status)).toEqual(["closing", "closing"]);
    expect(result.current.progressPercent).toBe(0);

    // Close-fill frame for the big child → it closes, progress advances.
    act(() => {
      fireNotification(1n);
    });
    expect(result.current.steps[0]!.status).toBe("closed");
    expect(result.current.closedQuantity).toBe(3n * ONE);
    expect(result.current.progressPercent).toBe(75);
    expect(result.current.status).toBe("closing");

    // Close-fill frame for the small child → the run finishes.
    act(() => {
      fireNotification(2n);
    });
    expect(result.current.steps[1]!.status).toBe("closed");
    expect(result.current.closedQuantity).toBe(4n * ONE);
    expect(result.current.progressPercent).toBe(100);
    expect(result.current.status).toBe("success");
  });

  it("reports an infeasible plan without submitting any close", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn();
    instantCloseBulkAutoMutationOptions.mockReturnValue({ mutationKey: ["instantCloseBulkAuto"], mutationFn });

    const only = makeChild({ key: "onchain:1", quantity: 1n * ONE });
    const { result } = renderHookWithProviders(() => useCloseQuoteGroup({ config }));

    let summary: Awaited<ReturnType<typeof result.current.close>> | undefined;
    await act(async () => {
      summary = await result.current.close({
        group: makeGroup([only]),
        targetQuantity: 2n * ONE, // above total open
        minAcceptableQuoteValue: MAQV,
        slippage: 5,
      });
    });

    expect(summary!.ok).toBe(false);
    expect(summary!.planFailure).toMatchObject({ feasible: false, reason: "exceeds-open" });
    expect(mutationFn).not.toHaveBeenCalled();
    expect(result.current.status).toBe("failed");
  });

  it("fails every step at once when the bulk submit is rejected", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockRejectedValue(new Error("hedger down"));
    instantCloseBulkAutoMutationOptions.mockReturnValue({ mutationKey: ["instantCloseBulkAuto"], mutationFn });

    const first = makeChild({ key: "onchain:1", quoteId: 1n, quantity: 2n * ONE });
    const second = makeChild({ key: "onchain:2", quoteId: 2n, quantity: 2n * ONE });
    const { result } = renderHookWithProviders(() => useCloseQuoteGroup({ config }));

    let summary: Awaited<ReturnType<typeof result.current.close>> | undefined;
    await act(async () => {
      summary = await result.current.close({
        group: makeGroup([first, second]),
        targetQuantity: 3n * ONE,
        minAcceptableQuoteValue: MAQV,
        slippage: 5,
      });
    });

    expect(summary!.ok).toBe(false);
    expect(summary!.error?.kind).toBe("unknown");
    // One request carries the whole batch — its rejection fails every step.
    expect(result.current.steps.map((step) => step.status)).toEqual(["failed", "failed"]);
    expect(result.current.status).toBe("failed");
    expect(result.current.progressPercent).toBe(0);
  });

  it("fails a step (and the run) on a failed frame from the solver", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue({ success: true });
    instantCloseBulkAutoMutationOptions.mockReturnValue({ mutationKey: ["instantCloseBulkAuto"], mutationFn });

    const only = makeChild({ key: "onchain:1", quoteId: 1n, quantity: 2n * ONE });
    const { result } = renderHookWithProviders(() => useCloseQuoteGroup({ config }));

    await act(async () => {
      await result.current.close({
        group: makeGroup([only]),
        targetQuantity: 1n * ONE,
        minAcceptableQuoteValue: MAQV,
        slippage: 5,
      });
    });

    act(() => {
      fireNotification(1n, { type: NotificationType.FAILED, failureMessage: "insufficient liquidity" });
    });
    expect(result.current.steps[0]!.status).toBe("failed");
    expect(result.current.steps[0]!.error?.message).toContain("insufficient liquidity");
    expect(result.current.status).toBe("failed");
    expect(result.current.progressPercent).toBe(0);
  });
});
