"use client";

import type { ConfigParameter, MarkPriceTick, SocketStatus, SolverId } from "@symmio/trading-core";
import { useRef } from "react";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { usePrices, type UsePricesRestFallback } from "./use-prices";

/**
 * Parameters for {@link usePriceByName}.
 */
export interface UsePriceByNameParameters extends ConfigParameter {
  /** Market name to price, e.g. `"BTCUSDT"`. Subscription is disabled while undefined. */
  name?: string;
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Solver whose price provider to subscribe to. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
  /** REST snapshot polling while the socket is degraded. See {@link usePrices}. */
  restFallback?: UsePricesRestFallback;
}

/**
 * Value returned by {@link usePriceByName}.
 */
export interface UsePriceByNameReturnType {
  /** Latest mark price as a decimal string, or `null` before the first tick. */
  markPrice: string | null;
  /** The full tick, for provider-specific fields. Narrow on `provider`. */
  tick: MarkPriceTick | null;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport/parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Track one market's mark price from whichever provider serves the resolved
 * solver.
 *
 * Subscribes with a single-name filter, so on Binance — whose stream pushes every
 * listed symbol once per second — this re-renders on that one market's ticks
 * rather than on all ~740. A ref gate suppresses re-renders when a tick repeats
 * the price already held.
 *
 * @example
 * ```tsx
 * const { markPrice, status } = usePriceByName({ name: "BTCUSDT", solverId: "rasa" });
 * return <span>{markPrice ?? "—"} ({status})</span>;
 * ```
 */
export function usePriceByName(parameters: UsePriceByNameParameters): UsePriceByNameReturnType {
  const { name, enabled = true, ...rest } = parameters;

  const { ticks, status, error } = usePrices({
    ...rest,
    names: name ? [name] : undefined,
    enabled: enabled && Boolean(name),
  });

  const tick = name ? (ticks[name] ?? null) : null;

  // Hold the last non-null tick so a transient gap does not blank the display.
  const lastTickRef = useRef<MarkPriceTick | null>(null);
  if (tick) lastTickRef.current = tick;
  const resolved = tick ?? lastTickRef.current;

  return { markPrice: resolved?.markPrice ?? null, tick: resolved, status, error };
}
