"use client";

import {
  calculatePositionLiquidationState,
  type CalculatePositionLiquidationStateParameters,
  type PositionLiquidationState,
} from "@symmio/trading-core";
import { useEffect, useReducer } from "react";

/** Supplied snapshot and live mark. This hook performs no network reads. */
export type UsePositionLiquidationStateParameters = Omit<CalculatePositionLiquidationStateParameters, "nowMs">;

/**
 * Derive risk from a complete shared VA snapshot and expire it when its mark
 * becomes stale, even when the feed stops emitting. Authoritative liquidation
 * survives mark expiry. No independent polling or account subscription is made.
 * @param parameters - Raw account snapshot and timestamped mark.
 * @returns Fresh risk or explicit unknown/stale/terminal state.
 * @example
 * const risk = usePositionLiquidationState({ ...snapshot, maxPriceAgeMs: 30_000 });
 */
export function usePositionLiquidationState(
  parameters: UsePositionLiquidationStateParameters,
): PositionLiquidationState {
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const expiresAt = parameters.mark ? parameters.mark.updatedAt + parameters.maxPriceAgeMs : undefined;
  useEffect(() => {
    if (expiresAt === undefined || !Number.isFinite(expiresAt)) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(refresh, Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return calculatePositionLiquidationState({ ...parameters, nowMs: Date.now() });
}
