"use client";

import {
  watchBinancePrices,
  type BinanceMarkPriceTick,
  type ConfigParameter,
  type SocketStatus,
  type SolverId,
} from "@symmio/trading-core";
import { useEffect, useRef, useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useBinancePrices}.
 */
export interface UseBinancePricesParameters extends ConfigParameter {
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Solver whose price provider to subscribe to. Must resolve to Binance. */
  solverId?: SolverId;
  /**
   * Restrict the accumulated map to these market names.
   *
   * **Strongly recommended.** The stream pushes every listed symbol (~740) once
   * per second; the filter is what keeps that from churning your component tree.
   */
  names?: readonly string[];
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
  /** Imperative per-tick callback, invoked in addition to map updates. */
  onTick?: (ticks: BinanceMarkPriceTick[]) => void;
}

/**
 * Value returned by {@link useBinancePrices}.
 */
export interface UseBinancePricesReturnType {
  /** Latest full Binance tick keyed by market name — `indexPrice` reachable without narrowing. */
  ticks: Record<string, BinanceMarkPriceTick>;
  /** Latest mark price keyed by market name. */
  prices: Record<string, string>;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport/parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to Binance USD-M Futures' all-market mark-price stream.
 *
 * The provider-specific twin of `usePrices`. Because the variant is fixed, every
 * tick is a `BinanceMarkPriceTick` — `indexPrice` and the Binance funding fields
 * are reachable without narrowing on `provider`. Prefer `usePrices` when the
 * component should work against either provider.
 *
 * Throws `UNSUPPORTED_BY_PRICE_SERVICE` (surfaced via `error`) when the target
 * solver is not priced by Binance.
 *
 * @example
 * ```tsx
 * const { ticks, status } = useBinancePrices({ solverId: "rasa", names: ["BTCUSDT"] });
 * return <span>{ticks["BTCUSDT"]?.indexPrice ?? "—"} ({status})</span>;
 * ```
 */
export function useBinancePrices(parameters: UseBinancePricesParameters = {}): UseBinancePricesReturnType {
  const { chainId, solverId, names, enabled = true, onTick } = parameters;
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const resolvedChainId = chainId ?? defaultChainId;

  const [ticks, setTicks] = useState<Record<string, BinanceMarkPriceTick>>({});
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const namesKey = names ? names.join(",") : undefined;

  /** Drop stale rows when the target changes — see `usePrices` for why. */
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
      unwatch = watchBinancePrices(config, {
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

  const prices: Record<string, string> = {};
  for (const [name, tick] of Object.entries(ticks)) prices[name] = tick.markPrice;

  return { ticks, prices, status, error };
}
