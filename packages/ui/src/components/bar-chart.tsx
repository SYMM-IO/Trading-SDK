"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import {
  CHART_INSET,
  ChartLegend,
  ChartTooltip,
  DIRECT_LABEL_CLASS,
  DIRECT_LABEL_HALO,
  TICK_LABEL_CLASS,
  seriesColor,
  stepActiveIndex,
  useMeasuredWidth,
  yGutterWidth,
  type ChartSeriesTone,
} from "./chart-chrome";
import { linearScale, niceTicks, pickTickIndices, roundedTopRect, stackSegments } from "./chart-scale";

/** One series of a bar chart: its identity and the palette slot it always paints with. */
export interface BarChartSeries {
  id: string;
  label: string;
  /** Palette slot. Fixed per series — a series keeps its color whatever else is on screen. */
  tone: ChartSeriesTone;
}

/** One x position, with a value per series in {@link BarChartProps.series} order. */
export interface BarChartBucket {
  /** Position on the x axis — a timestamp, in any consistent unit. Must ascend across the buckets. */
  x: number;
  /** One value per series, bottom of the stack first. Missing entries read as zero. */
  values: readonly number[];
}

export interface BarChartProps {
  /** The series, in stack order (first is drawn at the baseline). One series draws plain bars. */
  series: readonly BarChartSeries[];
  /** The buckets, ascending by `x`. */
  buckets: readonly BarChartBucket[];
  /** What the chart shows — the accessible name. */
  label: string;
  /** Format a value for the axis, the peak label, and the tooltip. */
  formatValue: (value: number) => string;
  /** Format an x value for the axis. */
  formatX: (x: number) => string;
  /** Format an x value for the tooltip title. Defaults to {@link BarChartProps.formatX}. */
  formatXDetail?: (x: number) => string;
  /** Total height in pixels — the plot **plus** the x-axis band, so nothing scrolls. */
  height?: number;
  /** Fixed width in pixels; when omitted the chart measures its container. */
  width?: number;
  className?: string;
  /** Test id for the wrapper; the SVG gets `${testId}-svg` and the tooltip `${testId}-tooltip`. */
  testId?: string;
}

/** Bars never fill their slot: cap the thickness and let the band's leftover be air. */
const MAX_BAR_WIDTH = 24;
/** Surface-colored gap between touching bars and between stacked segments. */
const SURFACE_GAP = 2;
/** Rounded data-end radius; the baseline end stays square. */
const CAP_RADIUS = 4;
/** Pixels of x-axis room one tick label needs, for choosing how many to draw. */
const X_LABEL_SLOT = 72;

/**
 * Discrete amounts per period — the form for a quantity that is *earned* or
 * *traded* each day rather than a level that persists. With one series the
 * bars are plain; with several they stack, separated by a surface-colored gap
 * rather than a border, and a legend names them.
 *
 * Each bar's whole column is its hit target, so the pointer only has to be
 * closest, not on the painted pixels. The hovered bar lifts, and one tooltip
 * lists every series at that x. With a single series the peak is directly
 * labeled; the rest is the axis's and the tooltip's job.
 */
export function BarChart({
  series,
  buckets,
  label,
  formatValue,
  formatX,
  formatXDetail = formatX,
  height = 220,
  width: explicitWidth,
  className,
  testId = "bar-chart",
}: BarChartProps) {
  const [wrapperRef, width] = useMeasuredWidth<HTMLDivElement>(explicitWidth);
  const [active, setActive] = React.useState<number | null>(null);
  const stacked = series.length > 1;

  const layout = React.useMemo(() => {
    if (width === 0 || buckets.length === 0) return null;

    const totals = buckets.map((bucket) => bucket.values.reduce((sum, value) => sum + Math.max(0, value), 0));
    const maxTotal = totals.reduce((max, total) => Math.max(max, total), 0);
    const ticks = niceTicks(maxTotal, 4);
    const tickLabels = ticks.map(formatValue);
    const left = yGutterWidth(tickLabels);
    const right = width - CHART_INSET.right;
    const top = CHART_INSET.top;
    const bottom = height - CHART_INSET.xAxis;

    const band = (right - left) / buckets.length;
    const barWidth = Math.max(2, Math.min(MAX_BAR_WIDTH, band - SURFACE_GAP));
    const yScale = linearScale([0, ticks[ticks.length - 1]!], [bottom, top]);
    const centers = buckets.map((_, index) => left + band * index + band / 2);

    const labelIndices = pickTickIndices(buckets.length, Math.max(2, Math.floor((right - left) / X_LABEL_SLOT)));
    const peakIndex = totals.indexOf(maxTotal);

    return {
      ticks,
      tickLabels,
      left,
      right,
      top,
      bottom,
      band,
      barWidth,
      yScale,
      centers,
      totals,
      labelIndices,
      peakIndex,
    };
  }, [width, buckets, height, formatValue]);

  function handleKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    const next = stepActiveIndex(event.key, active, buckets.length);
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
  }

  if (buckets.length === 0 || series.length === 0) return null;

  const lastIndex = buckets.length - 1;
  const activeBucket = active === null ? null : buckets[active];

  return (
    <div data-slot="bar-chart" data-testid={testId} className={cn("flex flex-col gap-2", className)}>
      {stacked ? <ChartLegend items={series} mark="rect" /> : null}

      <div ref={wrapperRef} className="relative w-full" style={{ height }}>
        {layout ? (
          <svg
            role="img"
            aria-label={label}
            tabIndex={0}
            width={width}
            height={height}
            className="focus-visible:ring-ring/40 block overflow-visible rounded-md outline-none focus-visible:ring-2"
            onPointerLeave={() => setActive(null)}
            onKeyDown={handleKeyDown}
            onFocus={() => setActive((current) => current ?? lastIndex)}
            onBlur={() => setActive(null)}
            data-testid={`${testId}-svg`}
          >
            {layout.ticks.map((tick, index) => {
              const y = layout.yScale(tick);
              return (
                <g key={tick}>
                  <line
                    x1={layout.left}
                    x2={layout.right}
                    y1={y}
                    y2={y}
                    className={index === 0 ? "stroke-border" : "stroke-border/60"}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={layout.left - CHART_INSET.yGap}
                    y={y}
                    dy="0.35em"
                    textAnchor="end"
                    className={TICK_LABEL_CLASS}
                  >
                    {layout.tickLabels[index]}
                  </text>
                </g>
              );
            })}

            {layout.labelIndices.map((index) => (
              <text
                key={index}
                x={layout.centers[index]}
                y={height - 6}
                textAnchor={index === 0 ? "start" : index === lastIndex ? "end" : "middle"}
                className={TICK_LABEL_CLASS}
              >
                {formatX(buckets[index]!.x)}
              </text>
            ))}

            {buckets.map((bucket, index) => (
              <Bar
                key={bucket.x}
                x={layout.centers[index]! - layout.barWidth / 2}
                width={layout.barWidth}
                segments={stackSegments(series.map((_, seriesIndex) => bucket.values[seriesIndex] ?? 0))}
                tones={series.map((entry) => entry.tone)}
                yScale={layout.yScale}
                lifted={active === index}
              />
            ))}

            {/* Single series: the peak is the one directly-labeled bar. */}
            {!stacked && layout.totals[layout.peakIndex]! > 0 ? (
              <text
                x={layout.centers[layout.peakIndex]}
                y={layout.yScale(layout.totals[layout.peakIndex]!) - 5}
                textAnchor="middle"
                className={DIRECT_LABEL_CLASS}
                style={DIRECT_LABEL_HALO}
                data-slot="bar-chart-peak"
              >
                {formatValue(layout.totals[layout.peakIndex]!)}
              </text>
            ) : null}

            {/* One hit column per bucket — wider than the bar, so the pointer only has to be closest. */}
            {buckets.map((bucket, index) => (
              <rect
                key={bucket.x}
                x={layout.left + layout.band * index}
                y={layout.top}
                width={layout.band}
                height={Math.max(0, layout.bottom - layout.top)}
                fill="transparent"
                onPointerMove={() => setActive(index)}
                data-slot="bar-chart-hit"
              />
            ))}
          </svg>
        ) : null}

        {layout && active !== null && activeBucket ? (
          <div data-testid={`${testId}-tooltip`} className="contents">
            <ChartTooltip
              title={formatXDetail(activeBucket.x)}
              rows={series.map((entry, seriesIndex) => ({
                id: entry.id,
                label: entry.label,
                value: formatValue(activeBucket.values[seriesIndex] ?? 0),
                tone: entry.tone,
              }))}
              x={layout.centers[active]!}
              width={width}
              showSeries={stacked}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface BarProps {
  x: number;
  width: number;
  segments: ReadonlyArray<readonly [number, number]>;
  tones: readonly ChartSeriesTone[];
  yScale: (value: number) => number;
  lifted: boolean;
}

/**
 * One bar, drawn as a stack of segments from the baseline up. Segments above
 * the first are shortened by the surface gap so the surface shows through
 * between them; only the topmost painted segment gets the rounded cap.
 */
function Bar({ x, width, segments, tones, yScale, lifted }: BarProps) {
  const painted = segments
    .map((segment, index) => ({ segment, tone: tones[index] ?? "muted", index }))
    .filter(({ segment }) => segment[1] > segment[0]);
  const topIndex = painted.length - 1;

  return (
    <g data-slot="bar-chart-bar" style={lifted ? { filter: "brightness(1.15)" } : undefined}>
      {painted.map(({ segment, tone, index }, order) => {
        const bottom = yScale(segment[0]) - (order === 0 ? 0 : SURFACE_GAP);
        const top = yScale(segment[1]);
        const heightPx = Math.max(0, bottom - top);
        if (heightPx === 0) return null;
        const isCap = order === topIndex;
        return isCap ? (
          <path key={index} d={roundedTopRect(x, top, width, heightPx, CAP_RADIUS)} fill={seriesColor(tone)} />
        ) : (
          <rect key={index} x={x} y={top} width={width} height={heightPx} fill={seriesColor(tone)} />
        );
      })}
    </g>
  );
}
