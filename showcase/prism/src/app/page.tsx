"use client";

import { Panel } from "@/components/panel";
import { ResizeHandle, useResizable } from "@/components/resizable";
import { EmptyState, Skeleton } from "@/components/table";
import { MarketHeader } from "@/features/trade/market-header";
import { OrderTicket } from "@/features/trade/order-ticket";
import { OrderbookPanel } from "@/features/trade/orderbook-panel";
import { PositionsBlotter } from "@/features/trade/positions-blotter";
import { PriceChart } from "@/features/trade/price-chart";
import { useSelectedMarket } from "@/features/trade/use-selected-market";
import { Suspense, useCallback, useRef, useState, type CSSProperties } from "react";

/** The chart's floor, and the height the blotter is never allowed to lose. */
const CHART_MIN = 220;
const BLOTTER_MIN = 168;

/** The gutter track, in pixels — at `xl` the drag handles *are* the gaps. */
const GUTTER = 12;

/** Fixed width of the order ticket. Only the chart and the book are resizable. */
const TICKET_WIDTH = 340;

export default function TradePage() {
  return (
    <Suspense fallback={<TradeSkeleton />}>
      <TradeScreen />
    </Suspense>
  );
}

/**
 * The trading surface.
 *
 * One layout serves both solvers. Nothing here branches on which deployment the
 * selected market belongs to — the panels ask the SDK about the market's own
 * deployment and render what it answers, including "this solver has no order
 * book", which is a real answer rather than an error.
 *
 * ## Why the shell is height-bounded
 *
 * A trading screen is a **workspace, not a document**: every region should be on
 * screen at once and scroll inside itself. The earlier layout let each panel
 * size to its own content in a shared grid, so the tallest cell in a row set the
 * height of every other cell in it — the order book's ladder, not the chart,
 * decided the chart's height; the row-spanning ticket column stretched past its
 * own panel and left a slab of dead background beneath it; and the blotter fell
 * below the fold.
 *
 * From `xl` up this is instead one `dvh`-bounded grid. The chart height and the
 * order-book width are the only free variables — both dragged by the user and
 * persisted — and the clamping lives in the CSS template rather than in the drag
 * handler, so a window resize re-solves it too. Below `xl` the same panels stack
 * and the page scrolls normally, because a phone has no workspace to bound.
 */
function TradeScreen() {
  const { selected, select, markets, isLoading } = useSelectedMarket();
  const [seedPrice, setSeedPrice] = useState<number | undefined>(undefined);

  /* The grid measures itself so a drag can never push the blotter off the
     bottom — the ceiling is "whatever is left after the blotter's floor". */
  const gridRef = useRef<HTMLDivElement>(null);

  const chartMax = useCallback(() => {
    const height = gridRef.current?.clientHeight ?? 0;
    return Math.max(CHART_MIN, height - BLOTTER_MIN - GUTTER);
  }, []);

  const chart = useResizable({
    storageKey: "prism.trade.chart-height",
    axis: "y",
    initial: 440,
    min: CHART_MIN,
    max: chartMax,
    surface: gridRef,
    cssVar: "--chart-h",
    label: "Resize the chart height",
    controls: "prism-chart-panel",
  });

  /* The book handle sits on the book's leading edge, so dragging right has to
     make it narrower — hence `invert`. */
  const book = useResizable({
    storageKey: "prism.trade.book-width",
    axis: "x",
    initial: 300,
    min: 232,
    max: 480,
    invert: true,
    surface: gridRef,
    cssVar: "--book-w",
    label: "Resize the chart and order book",
    controls: "prism-book-panel",
  });

  const shell = {
    "--chart-h": `${chart.size}px`,
    "--book-w": `${book.size}px`,
    "--gutter": `${GUTTER}px`,
    "--ticket-w": `${TICKET_WIDTH}px`,
    "--chart-min": `${CHART_MIN}px`,
    "--blotter-min": `${BLOTTER_MIN}px`,
  } as CSSProperties;

  if (isLoading && markets.length === 0) return <TradeSkeleton />;

  if (!selected) {
    return (
      <div className="flex h-full flex-col">
        <EmptyState
          className="m-auto"
          title="No markets in scope"
          body="Neither solver returned a market list. Check the SDK page for each deployment's health."
        />
      </div>
    );
  }

  return (
    <div style={shell} className="flex flex-col xl:h-full">
      <MarketHeader markets={markets} selected={selected} onSelect={select} />

      <div ref={gridRef} className="prism-trade-grid min-h-0 flex-1 p-3">
        <Panel
          id="prism-chart-panel"
          className="min-h-[420px] overflow-hidden xl:col-start-1 xl:row-start-1 xl:min-h-0"
        >
          <PriceChart market={selected} />
        </Panel>

        <ResizeHandle {...book.handleProps} axis="x" className="hidden xl:col-start-2 xl:row-start-1 xl:flex" />

        <Panel id="prism-book-panel" className="min-h-[420px] overflow-hidden xl:col-start-3 xl:row-start-1 xl:min-h-0">
          <OrderbookPanel market={selected} onPickPrice={setSeedPrice} />
        </Panel>

        <ResizeHandle
          {...chart.handleProps}
          axis="y"
          className="hidden xl:col-start-1 xl:col-end-4 xl:row-start-2 xl:flex"
        />

        {/* The ticket comes before the blotter in the DOM: stacked on a narrow
            screen, the control that places a trade must not sit below a table of
            positions the user may not have. Every `xl` cell is explicitly
            placed, so the order is free there. */}
        <div className="flex min-h-0 flex-col xl:col-start-5 xl:row-start-1 xl:row-end-4">
          {/* Keyed by market: leverage, side and a margin sized against the
              previous market's ceiling are all wrong the moment it changes. */}
          <OrderTicket key={selected.key} market={selected} seedPrice={seedPrice} />
        </div>

        <div className="flex min-h-0 flex-col xl:col-start-1 xl:col-end-4 xl:row-start-3">
          <PositionsBlotter />
        </div>
      </div>
    </div>
  );
}

/**
 * The first paint, in the shape of the real thing.
 *
 * A skeleton on a different grid to the content it stands in for produces a
 * layout jump the moment data lands — the one thing a skeleton exists to avoid.
 */
function TradeSkeleton() {
  const shell = {
    "--chart-h": "440px",
    "--book-w": "300px",
    "--gutter": `${GUTTER}px`,
    "--ticket-w": `${TICKET_WIDTH}px`,
    "--chart-min": `${CHART_MIN}px`,
    "--blotter-min": `${BLOTTER_MIN}px`,
  } as CSSProperties;

  return (
    <div style={shell} className="flex flex-col xl:h-full">
      <div className="border-b border-line-subtle bg-bg-1 px-5 py-3.5">
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="prism-trade-grid min-h-0 flex-1 p-3">
        <Skeleton className="h-[420px] xl:col-start-1 xl:row-start-1 xl:h-full" />
        <Skeleton className="h-[420px] xl:col-start-3 xl:row-start-1 xl:h-full" />
        <Skeleton className="h-[520px] xl:col-start-5 xl:row-start-1 xl:row-end-4 xl:h-full" />
        <Skeleton className="h-[220px] xl:col-start-1 xl:col-end-4 xl:row-start-3 xl:h-full" />
      </div>
    </div>
  );
}
