"use client";

import { watchEnigmaPrices, type ConfigParameter, type EnigmaPriceTick, type SocketStatus } from "@symmio/trading-core";
import { useEffect, useRef, useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPrices}.
 */
export interface UseEnigmaPricesParameters extends ConfigParameter {
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
  /** Imperative per-tick callback, invoked in addition to map updates. */
  onTick?: (ticks: EnigmaPriceTick[]) => void;
}

/**
 * Value returned by {@link useEnigmaPrices}.
 */
export interface UseEnigmaPricesReturnType {
  /** Latest mark price keyed by symbol name. */
  prices: Record<string, string>;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport/parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to the chain's Enigma lowcap price-service WebSocket.
 *
 * Accumulates the latest `markPrice` per symbol name; updates whenever a new
 * tick arrives. Pass `onTick` to also react imperatively (e.g. push into a
 * non-stateful sink). The subscription is shared across hook instances via the
 * SDK socket pool — multiple `useEnigmaPrices()` mounts cost one connection.
 *
 * @example
 * ```tsx
 * const { prices, status } = useEnigmaPrices();
 * return <span>BTC: {prices["BTCUSDT"] ?? "—"} ({status})</span>;
 * ```
 */
export function useEnigmaPrices(parameters: UseEnigmaPricesParameters = {}): UseEnigmaPricesReturnType {
  const { chainId, enabled = true, onTick } = parameters;
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const resolvedChainId = chainId ?? defaultChainId;

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    setError(null);

    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchEnigmaPrices(config, {
        chainId: resolvedChainId,
        onPrices: (ticks) => {
          setPrices((prev) => {
            let mutated = false;
            const next = { ...prev };
            for (const tick of ticks) {
              if (next[tick.name] !== tick.markPrice) {
                next[tick.name] = tick.markPrice;
                mutated = true;
              }
            }
            return mutated ? next : prev;
          });
          onTickRef.current?.(ticks);
        },
        onStatusChange: setStatus,
        onError: (err) => setError(normalizeSymmError(err)),
      });
    } catch (err) {
      setError(normalizeSymmError(err));
      setStatus("closed");
    }

    return () => unwatch?.();
  }, [enabled, config, resolvedChainId]);

  return { prices, status, error };
}
