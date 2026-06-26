"use client";

import { watchEnigmaPrices, type ConfigParameter, type SocketStatus } from "@theoldvarorg/core";
import { useEffect, useRef, useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPriceByName}.
 */
export interface UseEnigmaPriceByNameParameters extends ConfigParameter {
  /** Market symbol name (e.g. `"BTCUSDT"`). */
  name: string;
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
}

/**
 * Value returned by {@link useEnigmaPriceByName}.
 */
export interface UseEnigmaPriceByNameReturnType {
  /** Latest mark price for this symbol, or `null` until the first matching tick. */
  markPrice: string | null;
  /** Source timestamp (unix ms) from the latest matching tick, or `null`. */
  time: number | null;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport/parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to the chain's Enigma lowcap price WebSocket but track only one
 * symbol. The hook re-renders **only** when this symbol's `markPrice` changes
 * — unrelated ticks for other symbols never trigger a state update.
 *
 * Shares the pooled socket with every other Enigma-prices hook on the page.
 *
 * @example
 * ```tsx
 * const { markPrice, status } = useEnigmaPriceByName({ name: "BTCUSDT" });
 * return <span>BTC: {markPrice ?? "—"}</span>;
 * ```
 */
export function useEnigmaPriceByName(parameters: UseEnigmaPriceByNameParameters): UseEnigmaPriceByNameReturnType {
  const { name, chainId, enabled = true } = parameters;
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const resolvedChainId = chainId ?? defaultChainId;

  const [markPrice, setMarkPrice] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  // Tracks the last seen markPrice for this symbol. Used to skip setState
  // entirely when a tick repeats the same price — even the `time` field updates
  // are gated on price change so unrelated ticks never force a re-render.
  const lastPriceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      setMarkPrice(null);
      setTime(null);
      lastPriceRef.current = null;
      return;
    }

    setError(null);
    lastPriceRef.current = null;

    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchEnigmaPrices(config, {
        chainId: resolvedChainId,
        onPrices: (ticks) => {
          for (const tick of ticks) {
            if (tick.name !== name) continue;
            if (lastPriceRef.current === tick.markPrice) continue;
            lastPriceRef.current = tick.markPrice;
            setMarkPrice(tick.markPrice);
            if (tick.time !== undefined) setTime(tick.time);
          }
        },
        onStatusChange: setStatus,
        onError: (err) => setError(normalizeSymmError(err)),
      });
    } catch (err) {
      setError(normalizeSymmError(err));
      setStatus("closed");
    }

    return () => unwatch?.();
  }, [enabled, name, config, resolvedChainId]);

  return { markPrice, time, status, error };
}
