"use client";

import { DEPLOYMENTS, type Deployment, type MarketFamily } from "@/config/deployments";
import type { MarkPriceTick, SocketStatus } from "@symmio/trading-core";
import { usePrices } from "@symmio/trading-react";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

interface FamilyFeed {
  ticks: Record<string, MarkPriceTick>;
  status: SocketStatus;
}

const EMPTY_FEED: FamilyFeed = { ticks: {}, status: "closed" };

/**
 * A tiny subscription store for live prices.
 *
 * Context alone is the wrong shape here: the Binance mark-price stream pushes
 * every listed symbol once per second, so a context value that changed on each
 * tick would re-render the entire tree sixty times a minute. Components instead
 * subscribe through `useSyncExternalStore` to the one slice they read, so a BTC
 * row re-renders when BTC ticks and not when 700 other symbols do.
 */
class PriceStore {
  private feeds: Record<string, FamilyFeed> = {};
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(family: MarketFamily, feed: FamilyFeed): void {
    const current = this.feeds[family];
    if (current?.ticks === feed.ticks && current?.status === feed.status) return;
    this.feeds[family] = feed;
    for (const listener of this.listeners) listener();
  }

  feed(family: MarketFamily): FamilyFeed {
    return this.feeds[family] ?? EMPTY_FEED;
  }

  tick(family: MarketFamily, name: string): MarkPriceTick | undefined {
    return this.feeds[family]?.ticks[name];
  }

  price(family: MarketFamily, name: string): number | undefined {
    const raw = this.feeds[family]?.ticks[name]?.markPrice;
    if (raw === undefined) return undefined;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  status(family: MarketFamily): SocketStatus {
    return this.feeds[family]?.status ?? "closed";
  }

  streaming(family: MarketFamily): number {
    return Object.keys(this.feeds[family]?.ticks ?? {}).length;
  }
}

const PriceContext = createContext<PriceStore | undefined>(undefined);

/**
 * Live mark prices for every deployment at once.
 *
 * A WebSocket subscription cannot be fanned out with `useQueries` the way a
 * fetch can, and a hook cannot be called in a loop — so this mounts one
 * subscriber *component* per deployment. Adding a deployment adds a subscriber;
 * no screen changes.
 *
 * Both feeds run regardless of the palette mode: switching to Majors should
 * re-tint instantly, not re-open a socket.
 */
export function PriceProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<PriceStore>(undefined);
  storeRef.current ??= new PriceStore();
  const store = storeRef.current;

  return (
    <PriceContext.Provider value={store}>
      {DEPLOYMENTS.map((deployment) => (
        <DeploymentPriceFeed key={deployment.family} deployment={deployment} store={store} />
      ))}
      {children}
    </PriceContext.Provider>
  );
}

/**
 * One deployment's price subscription. Renders nothing.
 *
 * `usePrices` resolves whichever provider serves this solver — Binance USD-M
 * futures for majors, the Enigma lowcap price service for lowcaps — behind one
 * provider-agnostic API. The consumer never branches on which.
 */
function DeploymentPriceFeed({ deployment, store }: { deployment: Deployment; store: PriceStore }) {
  const { ticks, status } = usePrices({
    chainId: deployment.chainId,
    solverId: deployment.solverId,
  });

  useEffect(() => {
    store.set(deployment.family, { ticks, status });
  }, [store, deployment.family, ticks, status]);

  return null;
}

function usePriceStore(): PriceStore {
  const store = useContext(PriceContext);
  if (!store) {
    throw new Error("Price hooks must be used inside <PriceProvider>.");
  }
  return store;
}

/** Subscribe to one market's live mark price. Re-renders only when it moves. */
export function useMarkPrice(family: MarketFamily, name: string): number | undefined {
  const store = usePriceStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.price(family, name),
    () => undefined,
  );
}

/** Subscribe to one market's full tick — narrow on `provider` for extra fields. */
export function useMarkTick(family: MarketFamily, name: string): MarkPriceTick | undefined {
  const store = usePriceStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.tick(family, name),
    () => undefined,
  );
}

/** Subscribe to one deployment's price-socket status. */
export function useFeedStatus(family: MarketFamily): SocketStatus {
  const store = usePriceStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.status(family),
    () => "closed" as SocketStatus,
  );
}

export interface PrismPricesApi {
  /** Latest mark price for a market, as a number. */
  priceOf: (family: MarketFamily, name: string) => number | undefined;
  /** Full tick — narrow on `provider` for Binance index price / funding. */
  tickOf: (family: MarketFamily, name: string) => MarkPriceTick | undefined;
  /** Socket status for one deployment's price feed. */
  statusOf: (family: MarketFamily) => SocketStatus;
  /** How many markets this deployment's feed is currently carrying ticks for. */
  streamingCountOf: (family: MarketFamily) => number;
}

/**
 * Imperative access to the price store for components that read many markets
 * at once (a table), where per-market subscriptions would be worse.
 *
 * The returned functions are stable; a caller that needs to re-render on every
 * tick must also subscribe — `useTickSignal` exists for exactly that.
 */
export function usePrismPrices(): PrismPricesApi {
  const store = usePriceStore();
  return useMemo(
    () => ({
      priceOf: (family, name) => store.price(family, name),
      tickOf: (family, name) => store.tick(family, name),
      statusOf: (family) => store.status(family),
      streamingCountOf: (family) => store.streaming(family),
    }),
    [store],
  );
}

/**
 * Re-render on any price update, throttled to `intervalMs`.
 *
 * For a table showing hundreds of markets, one throttled repaint beats hundreds
 * of individual subscriptions. Pair it with {@link usePrismPrices}.
 */
export function useTickSignal(intervalMs = 1000): number {
  const store = usePriceStore();
  const versionRef = useRef(0);
  const lastRef = useRef(0);

  return useSyncExternalStore(
    (listener) => {
      return store.subscribe(() => {
        const now = Date.now();
        if (now - lastRef.current < intervalMs) return;
        lastRef.current = now;
        versionRef.current += 1;
        listener();
      });
    },
    () => versionRef.current,
    () => 0,
  );
}
