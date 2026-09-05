"use client";

import {
  estimateGroupTpSlReturn,
  planGroupTpSl,
  type GroupTpSlChild,
  type GroupTpSlDesiredMap,
  type GroupTpSlDesiredSide,
  type GroupTpSlReturnEstimate,
  type GroupTpSlSideKey,
  type PlanGroupTpSlResult,
  type TpSlConfig,
  type TpSlPriceType,
  type TpSlValidation,
} from "@symmio/trading-core";
import { useCallback, useMemo, useState } from "react";

/** Parameters for {@link useQuoteGroupTpSlEditor}. */
export interface UseQuoteGroupTpSlEditorParameters {
  /** Children with their confirmed snapshots — from {@link useQuoteGroupTpSl}. */
  children: readonly GroupTpSlChild[];
  /** Market price precision. Trigger prices are rounded to it before diffing. */
  pricePrecision: number;
  /** Reference price for validation (decimal string) — pass the live mark price. */
  referencePrice?: string;
  /** Live handler `/configs/` rules. Validation only runs when this and `referencePrice` are set. */
  config?: TpSlConfig;
}

/** Return type of {@link useQuoteGroupTpSlEditor}. */
export interface UseQuoteGroupTpSlEditorReturnType {
  /** The current edit buffer — hand this straight to {@link useSetQuoteGroupTpSl}. */
  desired: GroupTpSlDesiredMap;
  /** Set (or clear, with an empty trigger price) one side of one child. */
  setChildSide: (key: string, side: GroupTpSlSideKey, value: GroupTpSlDesiredSide | undefined) => void;
  /** Write one trigger price across **every** child — the "apply to entire position" control. */
  applyToAll: (side: GroupTpSlSideKey, triggerPrice: string, priceType?: TpSlPriceType) => void;
  /** Clear one side across every child (queues deletes for the live orders). */
  clearSide: (side: GroupTpSlSideKey) => void;
  /** Drop every pending edit and fall back to the confirmed snapshots. */
  reset: () => void;
  /** The live plan for the current buffer — what a submit would actually do. */
  plan: PlanGroupTpSlResult;
  /** Per-child validation failures, keyed by child key. Empty when everything passes. */
  errors: Record<string, TpSlValidation>;
  /** `true` when at least one child has an edit staged. */
  isDirty: boolean;
  /** `true` when the plan would write or cancel nothing. */
  isNoop: boolean;
  /** `true` when any child failed validation — gate the submit on this. */
  hasInvalid: boolean;
  /** Estimated group return per side at the currently staged triggers. */
  estimate: { takeProfit: GroupTpSlReturnEstimate; stopLoss: GroupTpSlReturnEstimate };
}

/**
 * Own the edit buffer behind a grouped TP/SL editor.
 *
 * The buffer is a `GroupTpSlDesiredMap` layered over the confirmed snapshots:
 * an entry wins over the handler's value, and an entry with an empty
 * `triggerPrice` clears that side. Every derived value — the live plan, the
 * per-child validation errors, the estimated return — is recomputed from
 * `@symmio/trading-core`'s pure helpers, so this hook holds state and nothing
 * else.
 *
 * Note that `applyToAll` writes the value to every child including ones the
 * planner will later skip (unanchored, closed): the plan is the authority on
 * what gets submitted, not the buffer.
 *
 * @param parameters - Children, price precision, and optional validation inputs.
 * @returns The buffer, its mutators, and everything derived from it.
 *
 * @example
 * ```tsx
 * const editor = useQuoteGroupTpSlEditor({ children, pricePrecision, referencePrice: markPrice, config });
 * editor.applyToAll("tp", "150");
 * if (!editor.hasInvalid) await set({ children, desired: editor.desired, subAccount, pricePrecision });
 * ```
 */
export function useQuoteGroupTpSlEditor(
  parameters: UseQuoteGroupTpSlEditorParameters,
): UseQuoteGroupTpSlEditorReturnType {
  const { children, pricePrecision, referencePrice, config } = parameters;
  const [desired, setDesired] = useState<GroupTpSlDesiredMap>({});

  const setChildSide = useCallback((key: string, side: GroupTpSlSideKey, value: GroupTpSlDesiredSide | undefined) => {
    setDesired((previous) => {
      const entry = { ...previous[key], [side]: value };
      // An entry with neither side is indistinguishable from no entry, and a
      // stale empty object would keep `isDirty` true forever.
      if (entry.tp === undefined && entry.sl === undefined) {
        const rest = { ...previous };
        delete rest[key];
        return rest;
      }
      return { ...previous, [key]: entry };
    });
  }, []);

  const applyToAll = useCallback(
    (side: GroupTpSlSideKey, triggerPrice: string, priceType?: TpSlPriceType) => {
      setDesired((previous) => {
        const next: Record<string, GroupTpSlDesiredMap[string]> = { ...previous };
        for (const child of children) {
          next[child.key] = { ...next[child.key], [side]: { triggerPrice, priceType } };
        }
        return next;
      });
    },
    [children],
  );

  const clearSide = useCallback(
    (side: GroupTpSlSideKey) => {
      applyToAll(side, "");
    },
    [applyToAll],
  );

  const reset = useCallback(() => setDesired({}), []);

  const plan = useMemo(
    () => planGroupTpSl({ children, desired, pricePrecision, referencePrice, config }),
    [children, desired, pricePrecision, referencePrice, config],
  );

  const errors = useMemo(() => {
    const map: Record<string, TpSlValidation> = {};
    for (const skip of plan.skips) {
      if (skip.reason === "invalid" && skip.validation) map[skip.key] = skip.validation;
    }
    return map;
  }, [plan]);

  const estimate = useMemo(
    () => ({
      takeProfit: estimateGroupTpSlReturn(children, { conditionalOrderType: "take_profit", overrides: desired }),
      stopLoss: estimateGroupTpSlReturn(children, { conditionalOrderType: "stop_loss", overrides: desired }),
    }),
    [children, desired],
  );

  return {
    desired,
    setChildSide,
    applyToAll,
    clearSide,
    reset,
    plan,
    errors,
    isDirty: Object.keys(desired).length > 0,
    isNoop: plan.isNoop,
    hasInvalid: plan.hasInvalid,
    estimate,
  };
}
