"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * The parts every chart is made of that are not the data marks: width
 * measurement, the series palette, the hover tooltip, and the legend. Kept
 * apart from the marks so an area chart and a bar chart share one tooltip and
 * one legend rather than two slightly different ones.
 */

/** Which palette slot a series paints with. Slots are validated in order; `"muted"` is the neutral "Other" bucket. */
export type ChartSeriesTone = 1 | 2 | 3 | 4 | 5 | "muted";

/** CSS color for a palette slot. Marks carry the series color; text never does. */
export function seriesColor(tone: ChartSeriesTone): string {
  return tone === "muted" ? "var(--muted-foreground)" : `var(--series-${tone})`;
}

/** Axis + tick geometry shared by every chart. */
export const CHART_INSET = {
  /** Room above the plot for the endpoint label and the tallest bar's cap. */
  top: 14,
  /** Room on the right so the last x label and the end marker are not clipped. */
  right: 12,
  /** Height of the x-axis label band under the plot. */
  xAxis: 22,
  /** Gap between a y tick label and the plot's left edge. */
  yGap: 8,
} as const;

/** Approximate advance of one character of the 10.5px mono tick face, for sizing the y gutter. */
const TICK_CHAR_WIDTH = 6.4;

/** Width of the y-axis gutter needed to fit the widest tick label. */
export function yGutterWidth(labels: readonly string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  return Math.ceil(longest * TICK_CHAR_WIDTH) + CHART_INSET.yGap;
}

/**
 * Measure an element's content width and re-render when it changes, so an SVG
 * can be laid out in real pixels (text does not scale like a `viewBox` would).
 *
 * @param explicit - Skip measuring and use this width (tests, stories, fixed layouts).
 */
export function useMeasuredWidth<T extends HTMLElement>(explicit?: number): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(explicit ?? 0);

  React.useLayoutEffect(() => {
    if (explicit !== undefined) return;
    const element = ref.current;
    if (!element) return;

    setWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [explicit]);

  return [ref, explicit ?? width];
}

/** One line of a tooltip: the value leads, the series name follows, a line key carries identity. */
export interface ChartTooltipRow {
  id: string;
  label: string;
  value: string;
  tone: ChartSeriesTone;
}

export interface ChartTooltipProps {
  /** Heading — the x position the rows describe (a date). */
  title: string;
  rows: readonly ChartTooltipRow[];
  /** Pixel x of the hovered position inside the chart. */
  x: number;
  /** Total chart width, to flip the tooltip away from the right edge. */
  width: number;
  /** Single-series charts hide the line key and the series name — the title already names it. */
  showSeries: boolean;
}

/** Tooltip width used to decide which side of the crosshair it sits on. */
const TOOLTIP_WIDTH = 168;

/**
 * The hover readout. Positioned absolutely inside the chart's relative
 * wrapper, beside the snapped x, flipping to the left when it would overflow.
 * Values are the strong element and series names secondary — the reader
 * already knows the series and wants the number.
 */
export function ChartTooltip({ title, rows, x, width, showSeries }: ChartTooltipProps) {
  const flip = x + TOOLTIP_WIDTH + 16 > width;
  return (
    <div
      role="status"
      data-slot="chart-tooltip"
      className="bg-popover text-popover-foreground ring-border/70 pointer-events-none absolute top-2 z-10 flex flex-col gap-1 rounded-lg px-2.5 py-2 text-xs shadow-md ring-1"
      style={{ left: flip ? x - TOOLTIP_WIDTH - 12 : x + 12, width: TOOLTIP_WIDTH }}
    >
      <span className="text-muted-foreground font-mono text-[10.5px] tabular-nums">{title}</span>
      {rows.map((row) => (
        <span key={row.id} className="flex items-center gap-2">
          {showSeries ? (
            <span
              aria-hidden
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: seriesColor(row.tone) }}
            />
          ) : null}
          <span className="text-foreground font-mono font-semibold tabular-nums">{row.value}</span>
          {showSeries ? <span className="text-muted-foreground min-w-0 truncate">{row.label}</span> : null}
        </span>
      ))}
    </div>
  );
}

export interface ChartLegendItem {
  id: string;
  label: string;
  tone: ChartSeriesTone;
}

interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  /** Legend swatches mirror the mark: a rect for bars and areas, a line for lines. */
  mark: "rect" | "line";
  className?: string;
}

/**
 * The identity channel for two or more series. Always rendered when there are
 * two or more — direct labels only ever supplement it.
 */
export function ChartLegend({ items, mark, className }: ChartLegendProps) {
  return (
    <ul data-slot="chart-legend" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li key={item.id} className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className={cn("shrink-0", mark === "rect" ? "size-2.5 rounded-[3px]" : "h-0.5 w-3 rounded-full")}
            style={{ backgroundColor: seriesColor(item.tone) }}
          />
          <span className="truncate">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Class for every axis tick label: mono, tabular, muted — text tokens, never the series color. */
export const TICK_LABEL_CLASS = "fill-muted-foreground font-mono text-[10.5px] tabular-nums";

/** Class for a direct label on a mark (the endpoint, the peak): primary ink, never the series color. */
export const DIRECT_LABEL_CLASS = "fill-foreground font-mono text-[11px] font-semibold tabular-nums";

/**
 * A surface-colored halo painted *under* a direct label's glyphs, so the label
 * stays legible where it crosses the line or a neighbouring bar — the text
 * equivalent of the marker's surface ring.
 */
export const DIRECT_LABEL_HALO: React.CSSProperties = {
  paintOrder: "stroke",
  stroke: "var(--card)",
  strokeWidth: 3,
  strokeLinejoin: "round",
};

/**
 * Keyboard handling shared by both charts: arrows walk the x positions, Home /
 * End jump to the ends, Escape clears. Returns the next active index or `null`
 * when the key is not one of ours.
 */
export function stepActiveIndex(key: string, current: number | null, count: number): number | null | undefined {
  if (count === 0) return undefined;
  const last = count - 1;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return current === null ? last : Math.min(last, current + 1);
    case "ArrowLeft":
    case "ArrowDown":
      return current === null ? last : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return last;
    case "Escape":
      return null;
    default:
      return undefined;
  }
}
