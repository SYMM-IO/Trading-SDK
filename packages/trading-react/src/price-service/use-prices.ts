"use client";

import {
  getMarkPricesQueryOptions,
  watchPrices,
  type ConfigParameter,
  type MarkPriceTick,
  type SocketStatus,
  type SolverId,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Default polling cadence while the socket is not `open`. */
const DEFAULT_REST_FALLBACK_INTERVAL_MS = 5_000;

/**
 * REST-fallback behaviour for {@link usePrices}.
 */
export interface UsePricesRestFallback {
  /** Poll a REST snapshot while the socket is degraded. Default `true`. */
  enabled?: boolean;
  /** Poll interval in ms. Default `5000`. */
  intervalMs?: number;
}

/**
 * Parameters for {@link usePrices}.
 */
export interface UsePricesParameters extends ConfigParameter {
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Solver whose price provider to subscribe to. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /**
   * Restrict the accumulated map to these market names.
   *
   * **Strongly recommended on Binance**, whose stream pushes every listed symbol
   * (~740) once per second — filtering turns that into a handful of state
   * updates instead of a full-map churn every tick.
   */
  names?: readonly string[];
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
  /** Imperative per-tick callback, invoked in addition to map updates. */
  onTick?: (ticks: MarkPriceTick[]) => void;
  /**
   * REST snapshot polling while the socket is not `"open"`.
   *
   * Implemented as a `useQuery` with `refetchInterval`, so it is visible in
   * devtools, deduplicated by query key, pausable by the app, and stops the
   * moment the socket reports `open`. Deliberately composed here rather than
   * hidden inside `watchPrices`: a watcher that silently became an HTTP poller
   * would report a socket status that no longer described where the data came
   * from.
   */
  restFallback?: UsePricesRestFallback;
}

/**
 * Value returned by {@link usePrices}.
 */
export interface UsePricesReturnType {
  /**
   * Latest full tick keyed by market name. Narrow on `provider` to reach
   * provider-specific fields such as Binance's `indexPrice`.
   */
  ticks: Record<string, MarkPriceTick>;
  /** Latest mark price keyed by market name — the ergonomic shape for display. */
  prices: Record<string, string>;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport/parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to the live mark-price feed of whichever provider serves the
 * resolved solver — Enigma's lowcap service, or Binance USD-M Futures for
 * majors.
 *
 * Accumulates the latest tick per market name and updates as ticks arrive. The
 * subscription is shared across hook instances via the SDK socket pool, so
 * several `usePrices()` mounts on one chain cost one connection even when they
 * ask for different `names`.
 *
 * Returns **both** shapes on purpose: `prices` for the common display case, and
 * `ticks` so a Binance consumer does not lose `indexPrice` and the funding
 * fields that only exist on the full tick.
 *
 * @example
 * ```tsx
 * const { prices, ticks, status } = usePrices({ solverId: "rasa", names: ["BTCUSDT"] });
 * const tick = ticks["BTCUSDT"];
 * return (
 *   <span>
 *     BTC {prices["BTCUSDT"] ?? "—"} ({status})
 *     {tick?.provider === "binance" ? ` index ${tick.indexPrice}` : null}
 *   </span>
 * );
 * ```
 */
export function usePrices(parameters: UsePricesParameters = {}): UsePricesReturnType {
  const { chainId, solverId, names, enabled = true, onTick, restFallback } = parameters;
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const resolvedChainId = chainId ?? defaultChainId;

  const [ticks, setTicks] = useState<Record<string, MarkPriceTick>>({});
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // Identity-stable across renders so an inline `names` array literal does not
  // resubscribe the socket on every render.
  const namesKey = names ? names.join(",") : undefined;

  /**
   * Drop accumulated ticks when the subscription target changes.
   *
   * Without this, switching solver (and therefore provider) leaves the previous
   * provider's ticks in the map, so a component renders Enigma prices while
   * labelled as Binance — and a name the new provider does not serve never
   * disappears. Keyed on the target rather than on `enabled`, so stopping and
   * restarting the same feed keeps its last values.
   */
  const subscriptionKey = `${resolvedChainId}|${solverId ?? ""}|${namesKey ?? ""}`;
  const lastSubscriptionKeyRef = useRef(subscriptionKey);
  if (lastSubscriptionKeyRef.current !== subscriptionKey) {
    lastSubscriptionKeyRef.current = subscriptionKey;
    setTicks({});
  }

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    setError(null);

    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchPrices(config, {
        chainId: resolvedChainId,
        solverId,
        names: namesKey ? namesKey.split(",") : undefined,
        onPrices: (batch) => {
          setTicks((prev) => {
            let mutated = false;
            const next = { ...prev };
            for (const tick of batch) {
              if (next[tick.name]?.markPrice !== tick.markPrice) {
                next[tick.name] = tick;
                mutated = true;
              }
            }
            return mutated ? next : prev;
          });
          onTickRef.current?.(batch);
        },
        onStatusChange: setStatus,
        onError: (err) => setError(normalizeSymmError(err)),
      });
    } catch (err) {
      setError(normalizeSymmError(err));
      setStatus("closed");
    }

    return () => unwatch?.();
  }, [enabled, config, resolvedChainId, solverId, namesKey]);

  /**
   * The fallback runs only while the socket is not delivering, so a healthy feed
   * costs no HTTP at all. `retry: false` keeps a degraded feed from retrying
   * into Binance's 429 → 418 IP-ban escalation.
   */
  const fallbackEnabled = enabled && (restFallback?.enabled ?? true) && status !== "open";
  const snapshot = useQuery({
    ...getMarkPricesQueryOptions(config, {
      chainId: resolvedChainId,
      solverId,
      names: namesKey ? namesKey.split(",") : undefined,
    }),
    enabled: fallbackEnabled,
    refetchInterval: restFallback?.intervalMs ?? DEFAULT_REST_FALLBACK_INTERVAL_MS,
    retry: false,
  });

  useEffect(() => {
    if (!snapshot.data?.length) return;
    setTicks((prev) => {
      let mutated = false;
      const next = { ...prev };
      for (const tick of snapshot.data) {
        if (next[tick.name]?.markPrice !== tick.markPrice) {
          next[tick.name] = tick;
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [snapshot.data]);

  const prices = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [name, tick] of Object.entries(ticks)) out[name] = tick.markPrice;
    return out;
  }, [ticks]);

  return { ticks, prices, status, error };
}
