import type { SocketStatus } from "@symmio/trading-core";
import { watchPrices } from "@symmio/trading-core";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSdkScope } from "./use-sdk-scope.js";

interface PricesContextValue {
  /** Latest mark price (decimal string) keyed by market name, e.g. `BTCUSDT`. */
  prices: Map<string, string>;
  status: SocketStatus;
}

const PricesContext = createContext<PricesContextValue>({ prices: new Map(), status: "connecting" });

/**
 * Subscribes once to the Enigma broadcast price feed and shares the latest
 * mark price per symbol with the whole app. Ticks are buffered in a ref and
 * flushed to React state on a fixed cadence so a busy feed never thrashes the
 * terminal render loop.
 */
export function PricesProvider({ children }: { children: ReactNode }) {
  const { config, chainId, solverId } = useSdkScope();
  const buffer = useRef(new Map<string, string>());
  const dirty = useRef(false);
  const [prices, setPrices] = useState<Map<string, string>>(new Map());
  const [status, setStatus] = useState<SocketStatus>("connecting");

  useEffect(() => {
    buffer.current = new Map();
    dirty.current = false;
    setPrices(new Map());
    setStatus("connecting");
    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchPrices(config, {
        chainId,
        solverId,
        onPrices: (ticks) => {
          for (const tick of ticks) buffer.current.set(tick.name, tick.markPrice);
          dirty.current = true;
        },
        onStatusChange: setStatus,
        onError: () => setStatus("reconnecting"),
      });
    } catch {
      setStatus("closed");
    }

    const flush = setInterval(() => {
      if (dirty.current) {
        dirty.current = false;
        setPrices(new Map(buffer.current));
      }
    }, 400);

    return () => {
      clearInterval(flush);
      unwatch?.();
    };
  }, [config, chainId, solverId]);

  const value = useMemo<PricesContextValue>(() => ({ prices, status }), [prices, status]);
  return <PricesContext.Provider value={value}>{children}</PricesContext.Provider>;
}

/** The whole live-price map plus socket status. */
export function useLivePrices(): PricesContextValue {
  return useContext(PricesContext);
}

/** The latest mark price for one market name, as a number (or null). */
export function usePrice(name?: string): number | null {
  const { prices } = useContext(PricesContext);
  if (!name) return null;
  const raw = prices.get(name);
  return raw != null ? Number(raw) : null;
}
