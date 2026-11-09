"use client";

import {
  watchEnigmaPrices,
  type Config,
  type ConfigParameter,
  type EnigmaPriceTick,
  type SocketStatus,
} from "@symmio/trading-core";
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
 * Prices, status and errors reset when the Config instance or resolved chain
 * changes. Reconnects and stopping/restarting the same target retain prices.
 * Callbacks from a disposed subscription are ignored.
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

  const [state, setState] = useState<PriceState>(() => emptyPriceState(config, resolvedChainId));
  // Reset during render so consumers never commit a previous deployment's prices.
  const current =
    state.config === config && state.chainId === resolvedChainId ? state : emptyPriceState(config, resolvedChainId);
  if (current !== state) setState(current);

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    let active = true;
    function update(updater: (previous: PriceState) => PriceState) {
      if (!active) return;
      setState((previous) =>
        previous.config === config && previous.chainId === resolvedChainId ? updater(previous) : previous,
      );
    }

    if (!enabled) {
      update((previous) => ({ ...previous, status: "closed" }));
      return;
    }

    update((previous) => ({ ...previous, error: null }));
    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchEnigmaPrices(config, {
        chainId: resolvedChainId,
        onPrices: (ticks) => {
          if (!active) return;
          update((previous) => {
            let mutated = false;
            const prices = { ...previous.prices };
            for (const tick of ticks) {
              if (prices[tick.name] !== tick.markPrice) {
                prices[tick.name] = tick.markPrice;
                mutated = true;
              }
            }
            return mutated ? { ...previous, prices } : previous;
          });
          onTickRef.current?.(ticks);
        },
        onStatusChange: (status) => update((previous) => ({ ...previous, status })),
        onError: (error) => update((previous) => ({ ...previous, error: normalizeSymmError(error) })),
      });
    } catch (error) {
      update((previous) => ({ ...previous, error: normalizeSymmError(error), status: "closed" }));
    }

    return () => {
      active = false;
      unwatch?.();
    };
  }, [enabled, config, resolvedChainId]);

  return { prices: current.prices, status: current.status, error: current.error };
}

interface PriceState extends UseEnigmaPricesReturnType {
  config: Config;
  chainId: number;
}

function emptyPriceState(config: Config, chainId: number): PriceState {
  return { config, chainId, prices: {}, status: "closed", error: null };
}
