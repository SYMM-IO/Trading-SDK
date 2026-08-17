"use client";

import type { Orderbook, OrderbookResyncReason, OrderbookSource, SocketStatus } from "@symmio/trading-core";
import { useEffect, useRef, useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Parameters for {@link useOrderbookStream}.
 */
export interface UseOrderbookStreamParameters {
  /** The order-book source to stream from. Must implement `watchOrderbook`. */
  source: OrderbookSource;
  /** Market name as SYMMIO names it. */
  marketName: string;
  /** Snapshot depth the live book is built on. Defaults to the source's own default. */
  limit?: number;
  /** Levels per side to receive on each update. Defaults to the source's own default. */
  levels?: number;
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
  /**
   * Called for every book update, ahead of the state update.
   *
   * Use this to drive a canvas depth chart imperatively without re-rendering on
   * every tick. The reference is read through a ref, so an inline arrow does
   * not re-subscribe.
   */
  onOrderbook?: (orderbook: Orderbook) => void;
  /** Called whenever the book is being rebuilt. Read through a ref. */
  onResync?: (reason: OrderbookResyncReason) => void;
}

/**
 * Value returned by {@link useOrderbookStream}.
 */
export interface UseOrderbookStreamReturnType {
  /** The latest synchronized book, or `null` until the first one arrives. */
  orderbook: Orderbook | null;
  /**
   * `true` while the book is being rebuilt from a fresh snapshot.
   *
   * {@link UseOrderbookStreamReturnType.orderbook} still holds the last good
   * book during a rebuild — show it dimmed rather than blanking the ladder.
   */
  isResyncing: boolean;
  /** Why the current or most recent rebuild happened, or `null` before the first. */
  resyncReason: OrderbookResyncReason | null;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport, parse, or snapshot error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to a continuously synchronized order book for one market.
 *
 * The heavy lifting — buffering, snapshot ordering, sequence verification and
 * rebuilding on a gap — happens inside the source. What this adds is the React
 * lifecycle: one subscription per (source, market, depth), torn down on unmount
 * or when `enabled` goes false, with handlers read through refs so inline
 * arrows never re-dial the socket.
 *
 * Prefer `useLiveOrderbook` when you want a ladder: it layers grouping,
 * cumulative depth and the spread on top of this.
 *
 * @param parameters - Source, market, depth, and handlers.
 * @returns The latest book plus connection and resync state.
 *
 * @example
 * ```tsx
 * const { orderbook, isResyncing, status } = useOrderbookStream({
 *   source,
 *   marketName: "BTCUSDT",
 *   levels: 15,
 * });
 * ```
 */
export function useOrderbookStream(parameters: UseOrderbookStreamParameters): UseOrderbookStreamReturnType {
  const { source, marketName, limit, levels, enabled = true, onOrderbook, onResync } = parameters;

  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncReason, setResyncReason] = useState<OrderbookResyncReason | null>(null);
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  /**
   * Handlers are read through refs so a consumer passing inline arrows does not
   * tear down and re-dial the socket on every render.
   */
  const onOrderbookRef = useRef(onOrderbook);
  const onResyncRef = useRef(onResync);
  onOrderbookRef.current = onOrderbook;
  onResyncRef.current = onResync;

  useEffect(() => {
    if (!enabled || !source.watchOrderbook) {
      setStatus("closed");
      return;
    }

    setError(null);
    /** A new market's book has nothing to do with the previous one's. */
    setOrderbook(null);

    let unwatch: (() => void) | undefined;
    try {
      unwatch = source.watchOrderbook({
        marketName,
        limit,
        levels,
        onOrderbook: (next) => {
          onOrderbookRef.current?.(next);
          setOrderbook(next);
          setIsResyncing(false);
        },
        onResync: (reason) => {
          onResyncRef.current?.(reason);
          setResyncReason(reason);
          setIsResyncing(true);
        },
        onStatusChange: setStatus,
        onError: (err) => setError(normalizeSymmError(err)),
      });
    } catch (err) {
      setError(normalizeSymmError(err));
      setStatus("closed");
    }

    return () => unwatch?.();
  }, [enabled, source, marketName, limit, levels]);

  return { orderbook, isResyncing, resyncReason, status, error };
}
