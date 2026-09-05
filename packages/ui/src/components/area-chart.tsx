"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import {
  CHART_INSET,
  ChartTooltip,
  DIRECT_LABEL_CLASS,
  DIRECT_LABEL_HALO,
  TICK_LABEL_CLASS,
  seriesColor,
  stepActiveIndex,
  useMeasuredWidth,
  yGutterWidth,
} from "./chart-chrome";
import { linearScale, nearestIndex, niceTicks, pickTickIndices } from "./chart-scale";

/** One sample of the series: a position on the x axis and its magnitude. */
export interface AreaChartPoint {
  /** Position on the x axis — a timestamp, in any consistent unit. Must ascend across the series. */
  x: number;
  /** The plotted magnitude. */
  y: number;
}

export interface AreaChartProps {
  /** The series, ascending by `x`. */
  points: readonly AreaChartPoint[];
  /** What the series is — the accessible name, and the tooltip's implicit series name. */
  label: string;
  /** Format a y value for the axis, the endpoint label, and the tooltip. */
  formatValue: (value: number) => string;
  /** Format an x value for the axis. */
  formatX: (x: number) => string;
  /** Format an x value for the tooltip title. Defaults to {@link AreaChartProps.formatX}. */
  formatXDetail?: (x: number) => string;
  /** Total height in pixels — the plot **plus** the x-axis band, so nothing scrolls. */
  height?: number;
  /** Fixed width in pixels; when omitted the chart measures its container. */
  width?: number;
  className?: string;
  /** Test id for the wrapper; the SVG gets `${testId}-svg` and the tooltip `${testId}-tooltip`. */
  testId?: string;
}

/** Radius of the endpoint and hover markers (`>= 4` so the dot is at least 8px). */
const MARKER_RADIUS = 4;

/** Pixels of x-axis room one tick label needs, for choosing how many to draw. */
const X_LABEL_SLOT = 72;

/**
 * A single continuous series over time — the form for a level that changes,
 * like TVL. The line is the mark; the fill under it is a wash that anchors the
 * line to its zero baseline without competing with it.
 *
 * One series, so there is no legend: the title names it. The endpoint is the
 * one directly-labeled point — "where it is now" — and the crosshair tooltip
 * carries every other value. Focus the chart and use the arrow keys to walk
 * the same readout without a pointer.
 */
export function AreaChart({
  points,
  label,
  formatValue,
  formatX,
  formatXDetail = formatX,
  height = 220,
  width: explicitWidth,
  className,
  testId = "area-chart",
}: AreaChartProps) {
  const [wrapperRef, width] = useMeasuredWidth<HTMLDivElement>(explicitWidth);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const gradientId = React.useId();
  const [active, setActive] = React.useState<number | null>(null);

  const layout = React.useMemo(() => {
    if (width === 0 || points.length === 0) return null;

    const maxY = points.reduce((max, point) => Math.max(max, point.y), 0);
    const ticks = niceTicks(maxY, 4);
    const tickLabels = ticks.map(formatValue);
    const left = yGutterWidth(tickLabels);
    const right = width - CHART_INSET.right;
    const top = CHART_INSET.top;
    const bottom = height - CHART_INSET.xAxis;

    const first = points[0]!.x;
    const last = points[points.length - 1]!.x;
    const xScale = linearScale(
      [first, last],
      first === last ? [(left + right) / 2, (left + right) / 2] : [left, right],
    );
    const yScale = linearScale([0, ticks[ticks.length - 1]!], [bottom, top]);

    const positions = points.map((point) => xScale(point.x));
    const heights = points.map((point) => yScale(point.y));
    const line = positions.map((px, index) => `${index === 0 ? "M" : "L"}${px},${heights[index]}`).join("");
    const area = `${line}L${positions[positions.length - 1]},${bottom}L${positions[0]},${bottom}Z`;

    const labelIndices = pickTickIndices(points.length, Math.max(2, Math.floor((right - left) / X_LABEL_SLOT)));

    return {
      ticks,
      tickLabels,
      left,
      right,
      top,
      bottom,
      xScale,
      yScale,
      positions,
      heights,
      line,
      area,
      labelIndices,
    };
  }, [width, points, height, formatValue]);

  function indexFromPointer(event: React.PointerEvent<SVGElement>): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !layout) return -1;
    return nearestIndex(layout.positions, event.clientX - rect.left);
  }

  function handleKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    const next = stepActiveIndex(event.key, active, points.length);
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
  }

  if (points.length === 0) return null;

  const lastIndex = points.length - 1;
  const activePoint = active === null ? null : points[active];

  return (
    <div
      ref={wrapperRef}
      data-slot="area-chart"
      data-testid={testId}
      className={cn("relative w-full", className)}
      style={{ height }}
    >
      {layout ? (
        <svg
          ref={svgRef}
          role="img"
          aria-label={label}
          tabIndex={0}
          width={width}
          height={height}
          className="focus-visible:ring-ring/40 block overflow-visible rounded-md outline-none focus-visible:ring-2"
          onPointerMove={(event) => setActive(indexFromPointer(event))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={handleKeyDown}
          onFocus={() => setActive((current) => current ?? lastIndex)}
          onBlur={() => setActive(null)}
          data-testid={`${testId}-svg`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor(1)} stopOpacity={0.16} />
              <stop offset="100%" stopColor={seriesColor(1)} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Gridlines — solid hairlines one step off the surface; the baseline a touch firmer. */}
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

          {/* X labels — first and last anchored inward so they never overhang the plot. */}
          {layout.labelIndices.map((index) => (
            <text
              key={index}
              x={layout.positions[index]}
              y={height - 6}
              textAnchor={index === 0 ? "start" : index === lastIndex ? "end" : "middle"}
              className={TICK_LABEL_CLASS}
            >
              {formatX(points[index]!.x)}
            </text>
          ))}

          <path d={layout.area} fill={`url(#${gradientId})`} data-slot="area-chart-fill" />
          <path
            d={layout.line}
            fill="none"
            stroke={seriesColor(1)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            data-slot="area-chart-line"
          />

          {/* The endpoint: the one point that is always marked and labeled. */}
          <EndMarker
            x={layout.positions[lastIndex]!}
            y={layout.heights[lastIndex]!}
            top={layout.top}
            text={formatValue(points[lastIndex]!.y)}
          />

          {active !== null && activePoint ? (
            <g data-slot="area-chart-crosshair" pointerEvents="none">
              <line
                x1={layout.positions[active]}
                x2={layout.positions[active]}
                y1={layout.top}
                y2={layout.bottom}
                className="stroke-muted-foreground/50"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              {active !== lastIndex ? (
                <circle
                  cx={layout.positions[active]}
                  cy={layout.heights[active]}
                  r={MARKER_RADIUS}
                  fill={seriesColor(1)}
                  className="stroke-card"
                  strokeWidth={2}
                />
              ) : null}
            </g>
          ) : null}

          {/* The hit area is the whole plot: readers aim at a date, never at the 2px line. */}
          <rect
            x={layout.left}
            y={layout.top}
            width={Math.max(0, layout.right - layout.left)}
            height={Math.max(0, layout.bottom - layout.top)}
            fill="transparent"
            data-slot="area-chart-hit"
          />
        </svg>
      ) : null}

      {layout && active !== null && activePoint ? (
        <div data-testid={`${testId}-tooltip`} className="contents">
          <ChartTooltip
            title={formatXDetail(activePoint.x)}
            rows={[{ id: "value", label, value: formatValue(activePoint.y), tone: 1 }]}
            x={layout.positions[active]!}
            width={width}
            showSeries={false}
          />
        </div>
      ) : null}
    </div>
  );
}

interface EndMarkerProps {
  x: number;
  y: number;
  top: number;
  text: string;
}

/** The last point: a ringed dot plus its value, set to whichever side has room. */
function EndMarker({ x, y, top, text }: EndMarkerProps) {
  const above = y - 9 > top;
  return (
    <g data-slot="area-chart-end">
      <circle cx={x} cy={y} r={MARKER_RADIUS} fill={seriesColor(1)} className="stroke-card" strokeWidth={2} />
      <text
        x={x - 8}
        y={above ? y - 7 : y + 15}
        textAnchor="end"
        className={DIRECT_LABEL_CLASS}
        style={DIRECT_LABEL_HALO}
      >
        {text}
      </text>
    </g>
  );
}
