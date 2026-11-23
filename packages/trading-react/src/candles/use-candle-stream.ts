"use client";

import type {
  Candle,
  CandleHistoryRange,
  CandleResolution,
  CandleSource,
  CandleUpdateMeta,
  SocketStatus,
} from "@symmio/trading-core";
import { useEffect, useRef, useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Parameters for {@link useCandleStream}.
 */
export interface UseCandleStreamParameters {
  /** The candle source to stream from. Must implement `watchCandles`. */
  source: CandleSource;
  /** Market name as SYMMIO names it. */
  marketName: string;
  /** Bar size to stream. */
  resolution: CandleResolution;
  /** Subscribe only when `true`. Default `true`. */
  enabled?: boolean;
  /**
   * Called for every bar update, ahead of the state update.
   *
   * Use this to drive a chart imperatively (`series.update(...)`) without
   * re-rendering on every tick. The reference is read through a ref, so an
   * inline arrow does not re-subscribe.
   */
  onCandle?: (candle: Candle, meta: CandleUpdateMeta) => void;
  /**
   * Called after reconnects or when the source detects historical corrections.
   * Forward the optional corrected range to history.refresh(range). Without a
   * range, refetch all retained history through the present time.
   */
  onReset?: (range?: CandleHistoryRange) => void;
}

/**
 * Value returned by {@link useCandleStream}.
 */
export interface UseCandleStreamReturnType {
  /** The most recent bar, or `null` until the first update arrives. */
  candle: Candle | null;
  /** `true` when {@link UseCandleStreamReturnType.candle} has closed. */
  closed: boolean;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport or parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
}

/**
 * Subscribe to live bar updates for one market and resolution.
 *
 * Returns the latest bar as state for simple cases (a price header, a
 * sparkline). For a full chart, prefer the `onCandle` callback and let the
 * charting library own the series — re-rendering a React tree on every tick is
 * wasted work when the chart mutates its own canvas.
 *
 * @param parameters - Source, market, resolution, and handlers.
 * @returns The latest bar plus connection status.
 *
 * @example
 * ```tsx
 * useCandleStream({
 *   source,
 *   marketName: "BTCUSDT",
 *   resolution: "1m",
 *   onCandle: (candle) => series.update(candle),
 *   onReset: () => refetchHistory(),
 * });
 * ```
 */
export function useCandleStream(parameters: UseCandleStreamParameters): UseCandleStreamReturnType {
  const { source, marketName, resolution, enabled = true, onCandle, onReset } = parameters;

  const [candle, setCandle] = useState<Candle | null>(null);
  const [closed, setClosed] = useState(false);
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<SymmioRequestError | null>(null);

  /**
   * Handlers are read through refs so a consumer passing inline arrows does not
   * tear down and re-dial the socket on every render.
   */
  const onCandleRef = useRef(onCandle);
  const onResetRef = useRef(onReset);
  onCandleRef.current = onCandle;
  onResetRef.current = onReset;

  useEffect(() => {
    setCandle(null);
    setClosed(false);
    setError(null);
    if (!enabled || !source.watchCandles) {
      setStatus("closed");
      return;
    }

    let active = true;
    let unwatch: (() => void) | undefined;
    try {
      unwatch = source.watchCandles({
        marketName,
        resolution,
        onCandle: (next, meta) => {
          if (!active) return;
          onCandleRef.current?.(next, meta);
          setCandle(next);
          setClosed(meta.closed);
        },
        onReset: (range) => {
          if (!active) return;
          setCandle(null);
          setClosed(false);
          onResetRef.current?.(range);
        },
        onStatusChange: (next) => {
          if (active) setStatus(next);
        },
        onError: (err) => {
          if (active) setError(normalizeSymmError(err));
        },
      });
    } catch (err) {
      setError(normalizeSymmError(err));
      setStatus("closed");
    }

    return () => {
      active = false;
      unwatch?.();
    };
  }, [enabled, source, marketName, resolution]);

  return { candle, closed, status, error };
}
