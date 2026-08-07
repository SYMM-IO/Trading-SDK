import type { GroupTpSlChild, QuoteTpSl } from "@symmio/trading-core";
import { PositionType } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useQuoteGroupTpSlEditor } from "./use-quote-group-tpsl-editor";

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

const CHILDREN = [makeChild("a", 1n), makeChild("b", 2n)];

describe("useQuoteGroupTpSlEditor", () => {
  it("starts clean with a no-op plan", () => {
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSlEditor({ children: CHILDREN, pricePrecision: 2 }),
    );

    expect(result.current.isDirty).toBe(false);
    expect(result.current.isNoop).toBe(true);
    expect(result.current.plan.sets).toHaveLength(0);
  });

  it("writes one value across every child with applyToAll", () => {
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSlEditor({ children: CHILDREN, pricePrecision: 2 }),
    );

    act(() => result.current.applyToAll("tp", "150"));

    expect(Object.keys(result.current.desired)).toEqual(["a", "b"]);
    expect(result.current.plan.sets).toHaveLength(2);
    expect(result.current.isDirty).toBe(true);
  });

  it("edits one child without touching the others", () => {
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSlEditor({ children: CHILDREN, pricePrecision: 2 }),
    );

    act(() => result.current.setChildSide("b", "tp", { triggerPrice: "150" }));

    expect(result.current.plan.sets.map((set) => set.key)).toEqual(["b"]);
  });

  it("drops a child's entry entirely when both sides are cleared to undefined", () => {
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSlEditor({ children: CHILDREN, pricePrecision: 2 }),
    );

    act(() => result.current.setChildSide("a", "tp", { triggerPrice: "150" }));
    act(() => result.current.setChildSide("a", "tp", undefined));

    expect(result.current.desired).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it("queues deletes when a side is cleared across the group", () => {
    const children = [
      makeChild("a", 1n, blankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "a-tp" })),
      makeChild("b", 2n, blankTpSl({ tp: "150", tpState: "new", tpCohQuoteId: "b-tp" })),
    ];
    const { result } = renderHookWithProviders(() => useQuoteGroupTpSlEditor({ children, pricePrecision: 2 }));

    act(() => result.current.clearSide("tp"));

    expect(result.current.plan.deletes.map((entry) => entry.cohQuoteId)).toEqual(["a-tp", "b-tp"]);
  });

  it("stays a no-op when the typed value already matches the handler", () => {
    const children = [makeChild("a", 1n, blankTpSl({ tp: "150.00", tpState: "new" }))];
    const { result } = renderHookWithProviders(() => useQuoteGroupTpSlEditor({ children, pricePrecision: 2 }));

    act(() => result.current.applyToAll("tp", "150"));

    expect(result.current.isDirty).toBe(true);
    expect(result.current.isNoop).toBe(true);
  });

  it("surfaces per-child validation errors and gates the submit", () => {
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSlEditor({
        children: CHILDREN,
        pricePrecision: 2,
        referencePrice: "100",
        config: { minPriceDistancePercent: 0.1, minProfitStopLossSpreadPercent: 0.1 },
      }),
    );

    // A LONG take-profit below the mark price is the wrong direction.
    act(() => result.current.setChildSide("a", "tp", { triggerPrice: "50" }));

    expect(result.current.hasInvalid).toBe(true);
    expect(result.current.errors["a"]).toMatchObject({ ok: false });
  });

  it("recomputes the estimated return as the buffer changes", () => {
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSlEditor({ children: CHILDREN, pricePrecision: 2 }),
    );

    expect(result.current.estimate.takeProfit.totalPnl).toBe(0n);

    act(() => result.current.applyToAll("tp", "150"));

    // Two 1-unit LONGs opened at 100, taking profit at 150 → +100.
    expect(result.current.estimate.takeProfit.totalPnl).toBe(100n * ONE);
  });

  it("reset drops every pending edit", () => {
    const { result } = renderHookWithProviders(() =>
      useQuoteGroupTpSlEditor({ children: CHILDREN, pricePrecision: 2 }),
    );

    act(() => result.current.applyToAll("tp", "150"));
    act(() => result.current.reset());

    expect(result.current.desired).toEqual({});
    expect(result.current.isNoop).toBe(true);
  });
});
