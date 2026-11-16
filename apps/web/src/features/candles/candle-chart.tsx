"use client";

import type { Candle, CandleHistoryPage } from "@symmio/trading-core";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { watchCandleChartNavigation } from "./candle-chart-navigation";

interface Props {
  /** Historical bars, ascending by time. Replaces the series whenever it changes. */
  candles: readonly Candle[];
  /** Retained HTTP windows. Fetched pages must retain their identities until revalidated. */
  historyPages?: readonly CandleHistoryPage[];
  /** The in-progress bar from the live stream, merged onto the series. */
  liveCandle?: Candle | null;
  /** Decimal places to render prices at, from the source's symbol metadata. */
  pricePrecision?: number;
  /** Rendered when there is nothing to draw yet. */
  emptyLabel?: string;
  /** Request an older window after the user pans or zooms toward the left edge. */
  onLoadOlder?: () => void;
}

/**
 * The SDK speaks unix **milliseconds**; lightweight-charts wants unix
 * **seconds**. This is the only place the two meet.
 */
function toChartTime(timeMs: number): UTCTimestamp {
  return Math.floor(timeMs / 1000) as UTCTimestamp;
}

function toCandlestickData(candle: Candle): CandlestickData<UTCTimestamp> {
  return {
    time: toChartTime(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function toVolumeData(candle: Candle, upColor: string, downColor: string): HistogramData<UTCTimestamp> {
  return {
    time: toChartTime(candle.time),
    value: candle.volume,
    color: candle.close >= candle.open ? upColor : downColor,
  };
}

/** The chart accepts only a replacement of its latest bar or a newer interval. */
function updateDrawnCandles(candles: Candle[], candle: Candle): void {
  if (candles.at(-1)?.time === candle.time) candles[candles.length - 1] = candle;
  else candles.push(candle);
}

/** Reads a resolved CSS custom property so the chart tracks the active theme. */
function readToken(element: HTMLElement, token: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  return value.length > 0 ? value : fallback;
}

/** The theme-derived colors the chart needs, resolved from the active palette. */
interface ChartTheme {
  up: string;
  down: string;
  text: string;
  border: string;
}

function readTheme(element: HTMLElement): ChartTheme {
  return {
    up: readToken(element, "--chart-2", "#26a69a"),
    down: readToken(element, "--chart-1", "#ef5350"),
    text: readToken(element, "--muted-foreground", "#8b8b8b"),
    border: readToken(element, "--border", "#2a2a2a"),
  };
}

/**
 * Candlestick + volume chart over the SDK's `Candle` shape.
 *
 * Deliberately imperative: the chart owns its own canvas, so history is pushed
 * with `setData` and each live tick with `update` rather than re-rendering
 * React on every tick. Colors are read from the app's theme tokens on mount and
 * re-read when the theme class changes, so the chart matches light and dark
 * without duplicating the palette.
 */
export function CandleChart({ candles, historyPages, liveCandle, pricePrecision = 2, emptyLabel, onLoadOlder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const colorsRef = useRef({ up: "#26a69a", down: "#ef5350" });
  const liveCandleRef = useRef(liveCandle);
  liveCandleRef.current = liveCandle;
  /** Set once per history load so the first paint fits, but panning is not fought afterwards. */
  const fittedKeyRef = useRef<string | null>(null);
  const drawnCandlesRef = useRef<Candle[]>([]);
  const previousHistoryRef = useRef<readonly Candle[]>([]);
  const previousPagesRef = useRef<readonly CandleHistoryPage[] | undefined>(undefined);
  const provisionalCandlesRef = useRef(new Map<number, Candle>());
  const lastDrawnTimeRef = useRef<number | undefined>(undefined);
  const lastDrawnLiveRef = useRef<Candle | null>(null);
  const onLoadOlderRef = useRef(onLoadOlder);
  onLoadOlderRef.current = onLoadOlder;
  const navigationRef = useRef<ReturnType<typeof watchCandleChartNavigation> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const provisionalCandles = provisionalCandlesRef.current;

    const theme = readTheme(container);
    const { up: upColor, down: downColor, text: textColor, border: borderColor } = theme;
    colorsRef.current = { up: upColor, down: downColor };

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: borderColor, style: 1 },
        horzLines: { color: borderColor, style: 1 },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor, scaleMargins: { top: 0.08, bottom: 0.26 } },
      timeScale: { borderColor, timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    /** Pins volume to the bottom quarter so it never overlaps the candles. */
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const navigation = watchCandleChartNavigation({
      container: frameRef.current ?? container,
      timeScale: chart.timeScale(),
      hasData: () => candleSeries.data().length > 0,
      onLoadOlder: () => onLoadOlderRef.current?.(),
    });
    navigationRef.current = navigation;

    return () => {
      navigation.dispose();
      navigationRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      fittedKeyRef.current = null;
      drawnCandlesRef.current = [];
      previousHistoryRef.current = [];
      previousPagesRef.current = undefined;
      provisionalCandles.clear();
      lastDrawnTimeRef.current = undefined;
      lastDrawnLiveRef.current = null;
    };
    /**
     * Mount-only. The chart owns live subscriptions and drawn data, so it must
     * never be torn down for a cosmetic option change — anything configurable
     * is pushed through `applyOptions` below instead.
     */
  }, []);

  /**
   * `next-themes` swaps the palette by toggling a class on `<html>`, which
   * changes what the CSS custom properties resolve to but tells the canvas
   * nothing — it is not styled by CSS. Re-read the tokens on that mutation and
   * push them through `applyOptions`, so a theme switch repaints the chart
   * instead of stranding it on the previous palette's colors.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const theme = readTheme(container);
      colorsRef.current = { up: theme.up, down: theme.down };

      chart.applyOptions({
        layout: { textColor: theme.text },
        grid: { vertLines: { color: theme.border }, horzLines: { color: theme.border } },
        rightPriceScale: { borderColor: theme.border },
        timeScale: { borderColor: theme.border },
      });
      candleSeriesRef.current?.applyOptions({
        upColor: theme.up,
        downColor: theme.down,
        borderUpColor: theme.up,
        borderDownColor: theme.down,
        wickUpColor: theme.up,
        wickDownColor: theme.down,
      });
      /** Volume color lives on each point, so the series has to be re-set. */
      volumeSeriesRef.current?.setData(
        drawnCandlesRef.current.map((candle) => toVolumeData(candle, theme.up, theme.down)),
      );
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  /**
   * Price precision arrives asynchronously from the source's symbol metadata,
   * after the chart already exists. Applied in place rather than by rebuilding.
   */
  useEffect(() => {
    candleSeriesRef.current?.applyOptions({
      priceFormat: { type: "price", precision: pricePrecision, minMove: 10 ** -pricePrecision },
    });
  }, [pricePrecision]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) return;

    navigationRef.current?.reset();
    const timeScale = chartRef.current?.timeScale();
    const visible = onLoadOlderRef.current ? timeScale?.getVisibleLogicalRange() : null;
    const previous = drawnCandlesRef.current;
    const anchor = visible ? previous[Math.max(0, Math.min(previous.length - 1, Math.ceil(visible.from)))] : undefined;
    const anchorIndex = anchor ? timeScale?.timeToIndex(toChartTime(anchor.time)) : null;

    const provisional = provisionalCandlesRef.current;
    const previousPages = new Set(previousPagesRef.current);
    const refreshedPages = historyPages?.filter((page) => !previousPages.has(page)) ?? [];
    if (historyPages) {
      /** Refetched windows own their gaps as well as their returned candles. */
      for (const time of provisional.keys()) {
        if (refreshedPages.some((page) => time >= page.from && time < page.to)) provisional.delete(time);
      }
    } else {
      const previousHistory = previousHistoryRef.current;
      const offset = candles.length - previousHistory.length;
      const prepended =
        onLoadOlderRef.current &&
        offset >= 0 &&
        previousHistory.every((candle, index) => candles[offset + index] === candle);
      if (!prepended) provisional.clear();
    }

    const live = liveCandleRef.current;
    const newestHistory = candles.at(-1);
    if (
      live &&
      (!historyPages || live !== lastDrawnLiveRef.current) &&
      live.time > (newestHistory?.time ?? -Infinity) &&
      !refreshedPages.some((page) => live.time >= page.from && live.time < page.to)
    ) {
      provisional.set(live.time, live);
    }

    const { up, down } = colorsRef.current;
    candleSeries.setData(candles.map(toCandlestickData));
    volumeSeries.setData(candles.map((candle) => toVolumeData(candle, up, down)));
    lastDrawnTimeRef.current = candles.at(-1)?.time;
    drawnCandlesRef.current = [...candles];
    for (const candle of [...provisional.values()].sort((a, b) => a.time - b.time)) {
      if (candle.time < (lastDrawnTimeRef.current ?? -Infinity)) {
        provisional.delete(candle.time);
        continue;
      }
      candleSeries.update(toCandlestickData(candle));
      volumeSeries.update(toVolumeData(candle, up, down));
      updateDrawnCandles(drawnCandlesRef.current, candle);
      lastDrawnTimeRef.current = candle.time;
    }
    /** Consume the snapshot's live prop even when HTTP removed that provisional interval. */
    lastDrawnLiveRef.current = live ?? null;
    previousHistoryRef.current = candles;
    previousPagesRef.current = historyPages;

    const key = `${candles.length}:${candles[0]?.time ?? 0}:${candles.at(-1)?.time ?? 0}`;
    if (visible && anchor && anchorIndex !== null && anchorIndex !== undefined) {
      const nextIndex = timeScale?.timeToIndex(toChartTime(anchor.time), true);
      if (nextIndex !== null && nextIndex !== undefined) {
        const shift = nextIndex - anchorIndex;
        timeScale?.setVisibleLogicalRange({ from: visible.from + shift, to: visible.to + shift });
      }
    } else if (candles.length > 0 && fittedKeyRef.current !== key) {
      timeScale?.fitContent();
      fittedKeyRef.current = key;
    }
  }, [candles, historyPages]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || !liveCandle || liveCandle === lastDrawnLiveRef.current) return;
    const lastDrawnTime = lastDrawnTimeRef.current;
    if (lastDrawnTime !== undefined && liveCandle.time < lastDrawnTime) return;

    const { up, down } = colorsRef.current;
    candleSeries.update(toCandlestickData(liveCandle));
    volumeSeries.update(toVolumeData(liveCandle, up, down));
    provisionalCandlesRef.current.set(liveCandle.time, liveCandle);
    updateDrawnCandles(drawnCandlesRef.current, liveCandle);
    lastDrawnTimeRef.current = liveCandle.time;
    lastDrawnLiveRef.current = liveCandle;
  }, [liveCandle]);

  return (
    <div ref={frameRef} className="relative h-105 w-full" data-testid="candle-chart">
      <div ref={containerRef} className="h-full w-full" />
      {candles.length === 0 && !liveCandle && emptyLabel ? (
        <p className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
