"use client";

import { Segmented } from "@/components/segmented";
import { EmptyState, Skeleton } from "@/components/table";
import type { PrismMarket } from "@/features/markets/types";
import type { CandleResolution } from "@symmio/trading-core";
import { useBinanceCandleSource, useCandles, useCandleStream } from "@symmio/trading-react";
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { PoolChart } from "./pool-chart";

/** Milliseconds per bar, for the history window the SDK asks for. */
const RESOLUTION_MS: Partial<Record<CandleResolution, number>> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

export interface PriceChartProps {
  market: PrismMarket;
}

/**
 * Timeframes for the candle chart.
 *
 * Only the candle chart needs this control. The pool chart is an embed that
 * ships its own timeframe toolbar, so drawing a second one above it would put
 * two selectors on screen that cannot agree with each other.
 */
const TIMEFRAMES = [
  { label: "1m", candle: "1m" },
  { label: "5m", candle: "5m" },
  { label: "15m", candle: "15m" },
  { label: "1h", candle: "1h" },
  { label: "4h", candle: "4h" },
  { label: "1D", candle: "1d" },
] as const satisfies readonly { label: string; candle: CandleResolution }[];

type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];

/**
 * The selected market's chart.
 *
 * The routing question here is deliberately **not** "which solver is this?" but
 * "how is this market priced?", because that is what decides whether bars exist:
 *
 * - A market with a reference-exchange listing has a `CandleSource` — the SDK
 *   ships a Binance one — and gets a real candlestick chart.
 * - A market that trades only in an on-chain liquidity pool has no bars to
 *   stream, but the SDK still resolves its pool, so it gets a pool chart.
 *
 * Both are charts. Neither is a fallback for the other, and no market that
 * SYMMIO lists is left without one.
 */
export function PriceChart({ market: entry }: PriceChartProps) {
  const [label, setLabel] = useState<TimeframeLabel>("15m");
  const timeframe = TIMEFRAMES.find((option) => option.label === label) ?? TIMEFRAMES[2];

  /* Enigma markets carry a `tokenAddress`, which is what resolves to a pool.
     That field — not the solver id — is the honest test for "poolPriced". */
  const poolPriced = entry.market.kind === "enigma";

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="flex min-h-9 items-center gap-3 border-b border-line-subtle px-4 py-2">
        {poolPriced ? null : (
          <Segmented
            options={TIMEFRAMES.map((option) => ({ value: option.label, label: option.label }))}
            value={label}
            onChange={setLabel}
            size="sm"
          />
        )}
        <span className="ml-auto text-2xs tracking-[0.12em] text-fg-3 uppercase">
          {poolPriced ? "Liquidity pool · DexScreener" : "Binance USD-M"}
        </span>
      </div>

      {poolPriced ? (
        <PoolChart market={entry} />
      ) : (
        <BinanceChart marketName={entry.market.name} resolution={timeframe.candle} />
      )}
    </div>
  );
}

interface ChartProps {
  marketName: string;
  resolution: CandleResolution;
}

/** The Binance-backed chart. Split out so its hooks only run when supported. */
function BinanceChart({ marketName, resolution }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const source = useBinanceCandleSource();

  /* `getCandles` takes an explicit window. Anchoring `to` to a coarse bucket
     rather than `Date.now()` keeps the query key stable between renders, so
     the history is fetched once per market/resolution instead of on every tick. */
  const window = useMemo(() => {
    const span = RESOLUTION_MS[resolution] ?? 60_000;
    const to = Math.floor(Date.now() / span) * span;
    return { from: to - span * 500, to };
  }, [resolution]);

  const history = useCandles({
    source,
    marketName,
    resolution,
    from: window.from,
    to: window.to,
    limit: 500,
  });

  /* Live bar updates. The SDK pushes both new bars and in-progress updates,
     and `series.update` handles either — the design system forbids animating
     chart data, so there is no transition here on purpose. */
  useCandleStream({
    source,
    marketName,
    resolution,
    onCandle: (candle) => {
      seriesRef.current?.update({
        time: (candle.time / 1000) as never,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    },
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { color: "transparent" },
        textColor: readToken("--fg-3"),
        fontFamily: readToken("--font-mono"),
        fontSize: 10,
      },
      grid: {
        vertLines: { color: readToken("--border-subtle") },
        horzLines: { color: readToken("--border-subtle") },
      },
      rightPriceScale: { borderColor: readToken("--border-subtle") },
      /* A horizontal drag changes the chart's width; without this the library
         silently changes how many candles are on screen instead of keeping the
         range the trader was looking at. */
      timeScale: { borderColor: readToken("--border-subtle"), timeVisible: true, lockVisibleTimeRangeOnResize: true },
      crosshair: { mode: 0 },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: readToken("--long-500"),
      downColor: readToken("--short-500"),
      wickUpColor: readToken("--long-500"),
      wickDownColor: readToken("--short-500"),
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  /* The create effect snapshots the palette, so a mode switch would leave the
     chart on the old one until it remounted. Re-applying on the attribute is
     cheaper than tearing the chart down and refetching its history. */
  useEffect(() => {
    const observer = new MutationObserver(() => {
      chartRef.current?.applyOptions({
        layout: { textColor: readToken("--fg-3") },
        grid: {
          vertLines: { color: readToken("--border-subtle") },
          horzLines: { color: readToken("--border-subtle") },
        },
        rightPriceScale: { borderColor: readToken("--border-subtle") },
        timeScale: { borderColor: readToken("--border-subtle") },
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !history.data) return;
    seriesRef.current.setData(
      history.data.candles.map((candle) => ({
        time: (candle.time / 1000) as never,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [history.data]);

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="absolute inset-0" />
      {history.isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-40 w-[85%]" />
        </div>
      ) : null}
      {history.isError ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <EmptyState
            title="Candles unavailable"
            body={history.error?.message ?? "The candle source did not respond."}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Resolve a design-system token to its computed value for the chart library. */
function readToken(token: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
