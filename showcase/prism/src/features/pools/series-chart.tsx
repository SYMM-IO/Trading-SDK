"use client";

import { EmptyState, Skeleton } from "@/components/table";
import { formatUsd } from "@/lib/format";
import { readToken } from "@/lib/read-token";
import {
  AreaSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

/** One point on a daily series. `time` is Unix **seconds**, as every pools read reports it. */
export interface SeriesPoint {
  time: number;
  value: number;
}

export interface SeriesChartProps {
  /** An `area` reads as a level that persists; `histogram` as a quantity per day. */
  kind: "area" | "histogram";
  points: readonly SeriesPoint[];
  /** Line/bar color. Defaults to the palette accent, so it follows the mode. */
  color?: string;
  height?: number;
  isLoading?: boolean;
  /** Shown in place of the chart when the series is empty. */
  emptyTitle: string;
  emptyBody?: string;
  /** Axis and crosshair formatter. Defaults to compact USD. */
  formatValue?: (value: number) => string;
}

/**
 * The pools screens' chart.
 *
 * Every pools series is the same shape — one figure per day, Unix seconds, no
 * live updates — so there is one chart component rather than one per card: TVL
 * as an area (a level that persists between snapshots) and volume or rewards as
 * histograms (a quantity that belongs to its day and to no other).
 *
 * Points arrive in whatever order the service returned them and are sorted and
 * de-duplicated here: lightweight-charts silently refuses a series whose times
 * are not strictly ascending, which reads as an empty chart rather than an
 * error.
 */
export function SeriesChart({
  kind,
  points,
  color,
  height = 260,
  isLoading = false,
  emptyTitle,
  emptyBody,
  formatValue,
}: SeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area" | "Histogram"> | null>(null);
  /* Held in a ref because the chart is created once and its formatter is read
     on every paint: passing the prop into the create effect would either stale
     the closure or tear the chart down whenever a parent re-renders. */
  const formatRef = useRef(formatValue);
  formatRef.current = formatValue;

  const data = useMemo(() => {
    const byTime = new Map<number, number>();
    for (const point of points) {
      if (!Number.isFinite(point.time) || !Number.isFinite(point.value)) continue;
      byTime.set(Math.trunc(point.time), point.value);
    }
    return [...byTime.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
  }, [points]);

  /* Read by the series-creation effect, which must not re-run when the points
     change — recreating the series on every tick would throw away the reader's
     zoom. */
  const dataRef = useRef(data);
  dataRef.current = data;

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
        vertLines: { visible: false },
        horzLines: { color: readToken("--border-subtle") },
      },
      rightPriceScale: { borderColor: readToken("--border-subtle") },
      timeScale: { borderColor: readToken("--border-subtle"), lockVisibleTimeRangeOnResize: true },
      crosshair: { mode: 0 },
      localization: {
        priceFormatter: (value: number) => (formatRef.current ?? formatUsd)(value),
      },
      handleScale: false,
      handleScroll: false,
      autoSize: true,
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  /* The series is re-created when the mark type changes, and its color is
     re-applied on every palette change — same MutationObserver contract as the
     candle chart, because a canvas cannot inherit a CSS variable. */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const paint = () => {
      const tone = resolveColor(color) || readToken("--accent");
      if (!seriesRef.current) return;
      if (kind === "area") {
        (seriesRef.current as ISeriesApi<"Area">).applyOptions({
          lineColor: tone,
          topColor: withAlpha(tone, 0.34),
          bottomColor: withAlpha(tone, 0.02),
        });
      } else {
        (seriesRef.current as ISeriesApi<"Histogram">).applyOptions({ color: tone });
      }
      chart.applyOptions({
        layout: { textColor: readToken("--fg-3") },
        grid: { horzLines: { color: readToken("--border-subtle") } },
        rightPriceScale: { borderColor: readToken("--border-subtle") },
        timeScale: { borderColor: readToken("--border-subtle") },
      });
    };

    seriesRef.current =
      kind === "area"
        ? chart.addSeries(AreaSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
        : chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });

    paint();

    /* The data effect below only runs when `data` changes, and a mark or color
       switch replaces the series object without touching it — so a recreated
       series has to be filled here or the chart renders empty until the points
       happen to change. */
    seriesRef.current.setData(dataRef.current);
    chart.timeScale().fitContent();

    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });

    return () => {
      observer.disconnect();
      if (seriesRef.current) {
        chart.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }
    };
  }, [kind, color]);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-[70%] w-[90%]" />
        </div>
      ) : null}
      {!isLoading && data.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <EmptyState title={emptyTitle} body={emptyBody} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Resolve a color the app expresses as a design token.
 *
 * Callers pass `var(--accent)` because that is how every other surface names a
 * color, but a canvas has no CSS context: `var()` and `color-mix()` both reach
 * the chart as literal strings and throw at `addColorStop`. This is the
 * translation layer — the same reason `readToken` exists for the chart's own
 * theming.
 */
function resolveColor(color: string | undefined): string {
  if (!color) return "";
  const token = /^var\(\s*(--[\w-]+)\s*\)$/.exec(color.trim());
  return token?.[1] ? readToken(token[1]) : color;
}

/**
 * Fade a resolved color for an area fill.
 *
 * Handles the two forms the palette actually holds — `#rrggbb` and
 * `rgb(…)`/`rgba(…)` — and returns the color untouched for anything else, which
 * degrades to an opaque fill rather than to a canvas exception.
 */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
  if (hex?.[1]) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    const value = Number.parseInt(digits, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
  if (rgb?.[1]) {
    const [red, green, blue] = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (red && green && blue) return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return color;
}
