"use client";

import * as React from "react";

import { cn } from "../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Spinner } from "./spinner";

/** Which side of the book a row rests on. */
export type OrderBookSide = "bid" | "ask";

/** Which sides {@link OrderBook} renders. */
export type OrderBookDisplay = "both" | "bids" | "asks";

/**
 * Feed state, drawn as a dot beside the title.
 *
 * `stale` is the one worth wiring: a book being rebuilt still shows its last
 * good rows, and this is what tells the reader those rows have stopped moving.
 */
export type OrderBookStatus = "idle" | "loading" | "live" | "stale" | "error";

/**
 * One rendered price level.
 *
 * `total` is the depth resting at or better than this price, **inclusive** of
 * this level's own size. It drives the depth bar, so an exclusive running total
 * would leave the best bid and ask with no bar at all.
 */
export interface OrderBookRowData {
  /** Limit price, quote-asset denominated. */
  price: number;
  /** Resting quantity at this price, base-asset denominated. */
  size: number;
  /** Cumulative size through this level, inclusive. */
  total: number;
}

/** Best prices and the gap between them, drawn in the seam. */
export interface OrderBookSpreadData {
  /** Highest resting bid. */
  bestBid: number;
  /** Lowest resting ask. */
  bestAsk: number;
  /** `bestAsk - bestBid`, in quote-asset units. */
  spread: number;
  /** The spread as basis points of the mid. */
  spreadBps: number;
  /** Arithmetic mid of the two touch prices. */
  midPrice: number;
}

/** A level plus the side it came from, handed to {@link OrderBookProps.onSelectLevel}. */
export interface OrderBookSelectedLevel extends OrderBookRowData {
  side: OrderBookSide;
}

/** Props for {@link OrderBook}. */
export interface OrderBookProps extends Omit<React.ComponentProps<"div">, "onSelect" | "title"> {
  /** Bid rows, best (highest) price first. */
  bids: readonly OrderBookRowData[];
  /** Ask rows, best (lowest) price first. */
  asks: readonly OrderBookRowData[];
  /** Touch prices and the gap between them. Omit and the seam shows a placeholder. */
  spread?: OrderBookSpreadData;
  /**
   * How depth bars are normalized. Default `"per-side"`.
   *
   * `per-side` scales each side against its own deepest row, so both sides show
   * the *shape* of their book — where the walls sit. Cross-side imbalance is
   * carried by {@link OrderBookProps.imbalance} instead, which is a far better
   * instrument for it: under a shared scale a side holding a fraction of the
   * other's depth collapses into invisible slivers and stops saying anything.
   *
   * `shared` scales both sides against the deeper one. Choose it when relative
   * size between the sides is the only thing you want the bars to convey.
   */
  scale?: "per-side" | "shared";
  /**
   * Explicit depth to scale every bar against, overriding
   * {@link OrderBookProps.scale}. Useful to hold the bars still across updates
   * rather than letting the scale breathe with the book.
   */
  maxTotal?: number;
  /**
   * Bid/ask notional imbalance in `[-1, 1]`, drawn as the seam's baseline rail.
   * Positive leans bid. Omit and the rail is hidden.
   */
  imbalance?: number;
  /** Base asset, e.g. `"BTC"` — labels the size and total columns. */
  baseAsset?: string;
  /** Quote asset, e.g. `"USDT"` — labels the price column. */
  quoteAsset?: string;
  /** Decimal places for prices. Default `2`. */
  pricePrecision?: number;
  /** Decimal places for sizes and totals. Default `4`. */
  sizePrecision?: number;
  /**
   * Rows reserved per side. Short sides are padded with blanks so the seam
   * holds still while levels come and go. Defaults to the longer side's length.
   */
  rows?: number;
  /** Which sides to render. Default `"both"`. */
  display?: OrderBookDisplay;
  /** Called with the next display mode. Omit and the toggle is hidden. */
  onDisplayChange?: (display: OrderBookDisplay) => void;
  /** Current price grouping, shown in the selector. */
  tickSize?: number;
  /** Groupings to offer. Omit or leave empty and the selector is hidden. */
  tickSizeOptions?: readonly number[];
  /** Called with the next grouping. */
  onTickSizeChange?: (tickSize: number) => void;
  /** Called when a row is activated by click or keyboard. Omit and rows are inert. */
  onSelectLevel?: (level: OrderBookSelectedLevel) => void;
  /** Feed state. Default `"idle"`. */
  status?: OrderBookStatus;
  /** Shown in place of the ladder when `status` is `"error"`. */
  errorMessage?: string;
  /** Shown when both sides are empty. Default `"No resting orders."`. */
  emptyLabel?: string;
  /** Panel heading. Default `"Order book"`. */
  title?: React.ReactNode;
  /**
   * Mark a row when its resting size moves meaningfully. Default `true`.
   *
   * Drawn as a soft tint fading in from the row's leading edge, in that side's
   * own colour. Deliberately quiet: a live book rewrites several times a
   * second, so anything louder reads as a strobe. Moves smaller than a tenth of
   * the level are ignored entirely — see {@link MIN_FLASH_CHANGE_RATIO}.
   * Suppressed under `prefers-reduced-motion`.
   */
  highlightChanges?: boolean;
  /** Prefix for `data-testid` hooks. Default `"order-book"`. */
  testId?: string;
}

const DISPLAY_OPTIONS: { value: OrderBookDisplay; label: string; hint: string }[] = [
  { value: "both", label: "Both", hint: "Show bids and asks" },
  { value: "bids", label: "Bids", hint: "Show bids only" },
  { value: "asks", label: "Asks", hint: "Show asks only" },
];

const STATUS_TONE: Record<OrderBookStatus, string> = {
  idle: "bg-muted-foreground/50",
  loading: "bg-warning",
  live: "bg-positive",
  stale: "bg-warning",
  error: "bg-negative",
};

const STATUS_LABEL: Record<OrderBookStatus, string> = {
  idle: "Idle",
  loading: "Loading",
  live: "Live",
  stale: "Resyncing",
  error: "Error",
};

/**
 * `Intl.NumberFormat` construction is the expensive part, and a ladder formats
 * three numbers per row several times a second. One formatter per precision,
 * built once and reused, keeps that off the hot path.
 */
const formatterCache = new Map<number, Intl.NumberFormat>();

function getFormatter(precision: number): Intl.NumberFormat {
  const key = Math.max(0, Math.min(20, Math.trunc(precision)));
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: key,
      maximumFractionDigits: key,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return "—";
  return getFormatter(precision).format(value);
}

/**
 * A tight major can sit well under one basis point, where a fixed single
 * decimal reports every spread as `0.0`. Precision follows the magnitude so the
 * number stays informative on a 0.016 bps BTC book and stays readable on a wide one.
 */
function formatBps(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const magnitude = Math.abs(value);
  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 1) return value.toFixed(1);
  return value.toFixed(3);
}

/**
 * Remember each level's previous size so a changed one can be tinted.
 *
 * Keyed per side, and reset whenever the grouping changes — regrouping renames
 * every level, and comparing across that would flash the whole ladder.
 */
/**
 * Smallest relative size move that lights a row up.
 *
 * A live book rewrites a few times a second and most of those writes are
 * fractional dust. Tinting every one of them turns the ladder into a strobe
 * that says nothing — the eye cannot separate a level being swept from a
 * market maker shaving a decimal. A tenth is low enough to catch a real fill
 * and high enough to drop the noise floor.
 */
const MIN_FLASH_CHANGE_RATIO = 0.1;

function hasMeaningfulChange(previousSize: number | undefined, size: number): boolean {
  /** No baseline yet — the first paint of a level is not a change. */
  if (previousSize === undefined) return false;
  if (previousSize === size) return false;

  /** A level appearing or being cleared always counts, whatever its size. */
  if (previousSize === 0 || size === 0) return true;

  return Math.abs(size - previousSize) / previousSize >= MIN_FLASH_CHANGE_RATIO;
}

const NO_PREVIOUS_SIZES: ReadonlyMap<number, number> = new Map();

function usePreviousSizes(rows: readonly OrderBookRowData[], resetKey: unknown): ReadonlyMap<number, number> {
  const previousRef = React.useRef<{ key: unknown; sizes: Map<number, number> }>({ key: resetKey, sizes: new Map() });

  /**
   * Recorded after paint rather than during render: a render-phase write would
   * be a side effect, and React may render a component twice before committing.
   */
  React.useEffect(() => {
    previousRef.current = { key: resetKey, sizes: new Map(rows.map((row) => [row.price, row.size])) };
  }, [rows, resetKey]);

  /**
   * The stored key is compared here, not in the effect, so a regrouping takes
   * effect on the very render that changes it. Clearing in the effect instead
   * would let one render compare the new grouping's levels against the old
   * grouping's, lighting up the entire ladder.
   */
  return previousRef.current.key === resetKey ? previousRef.current.sizes : NO_PREVIOUS_SIZES;
}

interface RowProps {
  row?: OrderBookRowData;
  side: OrderBookSide;
  maxTotal: number;
  pricePrecision: number;
  sizePrecision: number;
  previousSize?: number;
  highlightChanges: boolean;
  onSelectLevel?: (level: OrderBookSelectedLevel) => void;
  testId: string;
  index: number;
}

function OrderBookRow({
  row,
  side,
  maxTotal,
  pricePrecision,
  sizePrecision,
  previousSize,
  highlightChanges,
  onSelectLevel,
  testId,
  index,
}: RowProps) {
  /** A blank keeps the seam from sliding when a side runs short. */
  if (!row) {
    return <div aria-hidden className="h-[22px]" data-slot="order-book-row" data-empty="true" />;
  }

  const priceTone = side === "bid" ? "text-positive" : "text-negative";
  const barTone = side === "bid" ? "bg-positive/16 dark:bg-positive/20" : "bg-negative/16 dark:bg-negative/20";
  const depth = maxTotal > 0 ? Math.min(1, row.total / maxTotal) : 0;

  const changed = highlightChanges && hasMeaningfulChange(previousSize, row.size);
  /**
   * The row's own side colour, not a green/red up-down tint. A red flash over a
   * green bid row reads as the wrong side for the instant it lasts, and
   * direction is already carried by the size and the bar's length.
   */
  const flashTone = side === "bid" ? "from-positive/18" : "from-negative/18";

  const interactive = Boolean(onSelectLevel);
  const label = `${side === "bid" ? "Bid" : "Ask"} ${formatNumber(row.price, pricePrecision)}, size ${formatNumber(row.size, sizePrecision)}`;

  return (
    <div
      data-slot="order-book-row"
      data-side={side}
      data-testid={`${testId}-${side}-${index}`}
      role={interactive ? "button" : "row"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label}
      onClick={interactive ? () => onSelectLevel?.({ ...row, side }) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelectLevel?.({ ...row, side });
            }
          : undefined
      }
      className={cn(
        "group/row focus-visible:ring-ring/50 relative flex h-[22px] items-center font-mono text-[11px] leading-none outline-none",
        interactive && "cursor-pointer focus-visible:ring-2",
      )}
    >
      {/*
        The depth bar is a transform, not a width: scaling composites on the GPU
        and never triggers layout, which matters when every row rewrites twice a
        second. Anchored right so the wedge opens away from the seam, which is
        the direction depth actually accumulates.
      */}
      <span
        aria-hidden
        data-slot="order-book-depth"
        className={cn(
          "absolute inset-y-px right-0 left-0 origin-right rounded-[2px] transition-transform duration-200 ease-out motion-reduce:transition-none",
          barTone,
        )}
        style={{ transform: `scaleX(${depth})` }}
      />

      {changed ? (
        <span
          /* Remounting on a size change restarts the fade; without the key React reuses the node and nothing plays. */
          key={`${row.price}:${row.size}`}
          aria-hidden
          data-slot="order-book-flash"
          data-direction={row.size > (previousSize ?? 0) ? "up" : "down"}
          className={cn(
            "animate-out fade-out-0 fill-mode-forwards absolute inset-y-0 left-0 w-2/5 rounded-l-[2px] bg-gradient-to-r to-transparent duration-1000 ease-out motion-reduce:hidden",
            flashTone,
          )}
        />
      ) : null}

      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 w-px opacity-0 transition-opacity group-hover/row:opacity-100 motion-reduce:transition-none",
          side === "bid" ? "bg-positive right-0" : "bg-negative right-0",
        )}
      />

      <span className={cn("relative z-10 flex-1 pl-3 text-left tabular-nums", priceTone)}>
        {formatNumber(row.price, pricePrecision)}
      </span>
      <span className="text-foreground/85 relative z-10 flex-1 pr-3 text-right tabular-nums">
        {formatNumber(row.size, sizePrecision)}
      </span>
      <span className="text-muted-foreground relative z-10 hidden flex-1 pr-3 text-right tabular-nums @[15rem]/order-book:block">
        {formatNumber(row.total, sizePrecision)}
      </span>
    </div>
  );
}

interface ColumnLabelsProps {
  baseAsset?: string;
  quoteAsset?: string;
}

function OrderBookColumnLabels({ baseAsset, quoteAsset }: ColumnLabelsProps) {
  return (
    <div
      data-slot="order-book-column-labels"
      className="text-muted-foreground/80 flex items-center px-3 pb-1 text-[10px] tracking-wider uppercase"
    >
      <span className="flex-1 text-left">Price{quoteAsset ? ` (${quoteAsset})` : ""}</span>
      <span className="flex-1 text-right">Size{baseAsset ? ` (${baseAsset})` : ""}</span>
      <span className="hidden flex-1 text-right @[15rem]/order-book:block">Total</span>
    </div>
  );
}

interface SeamProps {
  spread?: OrderBookSpreadData;
  imbalance?: number;
  pricePrecision: number;
  testId: string;
}

/**
 * The seam: the one place buyers and sellers refuse to meet.
 *
 * Everything else in the panel is a quiet monospace grid, so this is where the
 * design spends its attention — a full-bleed rule in the brand accent, the mid
 * set in the display face rather than the ladder's mono, and a baseline rail
 * splitting bid against ask notional. One element saying where the market is
 * and which way it leans.
 */
function OrderBookSeam({ spread, imbalance, pricePrecision, testId }: SeamProps) {
  /** Map [-1, 1] onto the rail's split point, clamped so a rout still shows a sliver. */
  const bidShare = imbalance === undefined ? undefined : Math.min(96, Math.max(4, ((imbalance + 1) / 2) * 100));

  return (
    <div data-slot="order-book-seam" data-testid={`${testId}-seam`} className="relative my-1 py-1.5">
      <span aria-hidden className="bg-primary/35 absolute inset-x-0 top-0 h-px" />

      <div className="flex items-baseline gap-2 px-3">
        {spread ? (
          <>
            <span
              className="font-display text-foreground text-[15px] font-semibold tabular-nums"
              data-testid={`${testId}-mid`}
            >
              {formatNumber(spread.midPrice, pricePrecision)}
            </span>
            <span className="text-muted-foreground ml-auto font-mono text-[11px] tabular-nums">
              {formatNumber(spread.spread, pricePrecision)}
            </span>
            <span className="text-muted-foreground/70 font-mono text-[10px] tabular-nums">
              {formatBps(spread.spreadBps)} bps
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/70 font-mono text-[11px]">Spread unavailable</span>
        )}
      </div>

      {bidShare === undefined ? null : (
        <div
          className="mt-1.5 flex h-[3px] gap-px px-3"
          role="img"
          aria-label={`Depth imbalance: ${(bidShare - 50).toFixed(0)} percent toward ${bidShare >= 50 ? "bids" : "asks"}`}
          data-testid={`${testId}-imbalance`}
        >
          <span
            className="bg-positive/70 rounded-l-full transition-[flex-basis] duration-300 ease-out motion-reduce:transition-none"
            style={{ flexBasis: `${bidShare}%` }}
          />
          <span className="bg-negative/70 flex-1 rounded-r-full" />
        </div>
      )}
    </div>
  );
}

/**
 * A live depth ladder: asks stacked above the spread, bids below, each row
 * carrying a cumulative depth bar.
 *
 * Purely presentational — it takes rows and callbacks and knows nothing about
 * where the book came from. Feed it from `useLiveOrderbook` in
 * `@symmio/trading-react`, from your own venue adapter, or from fixtures.
 *
 * Two details that matter in use: both sides are scaled against one
 * `maxTotal`, so a thin side reads as thin instead of being stretched to fill
 * its column; and short sides are padded to `rows`, so the seam holds still
 * while levels come and go rather than jittering with every update.
 *
 * @example
 * ```tsx
 * <OrderBook
 *   bids={bids}
 *   asks={asks}
 *   spread={spread}
 *   maxTotal={maxTotal}
 *   baseAsset="BTC"
 *   quoteAsset="USDT"
 *   pricePrecision={1}
 *   status={isResyncing ? "stale" : "live"}
 *   onSelectLevel={(level) => setLimitPrice(level.price)}
 * />
 * ```
 */
export function OrderBook({
  bids,
  asks,
  spread,
  scale = "per-side",
  maxTotal,
  imbalance,
  baseAsset,
  quoteAsset,
  pricePrecision = 2,
  sizePrecision = 4,
  rows,
  display = "both",
  onDisplayChange,
  tickSize,
  tickSizeOptions,
  onTickSizeChange,
  onSelectLevel,
  status = "idle",
  errorMessage,
  emptyLabel = "No resting orders.",
  title = "Order book",
  highlightChanges = true,
  testId = "order-book",
  className,
  ...props
}: OrderBookProps) {
  const rowCount = rows ?? Math.max(bids.length, asks.length);

  const { bidScale, askScale } = React.useMemo(() => {
    const deepestBid = bids.at(-1)?.total ?? 0;
    const deepestAsk = asks.at(-1)?.total ?? 0;

    if (maxTotal !== undefined && maxTotal > 0) return { bidScale: maxTotal, askScale: maxTotal };
    if (scale === "shared") {
      const both = Math.max(deepestBid, deepestAsk);
      return { bidScale: both, askScale: both };
    }
    return { bidScale: deepestBid, askScale: deepestAsk };
  }, [maxTotal, scale, bids, asks]);

  const previousBids = usePreviousSizes(bids, tickSize);
  const previousAsks = usePreviousSizes(asks, tickSize);

  const showBids = display !== "asks";
  const showAsks = display !== "bids";
  const isEmpty = bids.length === 0 && asks.length === 0;

  /** Asks read outward from the seam, so the best ask sits closest to it. */
  const askRows = React.useMemo(() => padRows(asks, rowCount).reverse(), [asks, rowCount]);
  const bidRows = React.useMemo(() => padRows(bids, rowCount), [bids, rowCount]);

  return (
    <div
      data-slot="order-book"
      data-status={status}
      data-testid={testId}
      className={cn(
        "ring-border/70 bg-card @container/order-book flex flex-col overflow-hidden rounded-xl ring-1",
        className,
      )}
      {...props}
    >
      <div className="border-border/60 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn("size-1.5 shrink-0 rounded-full", STATUS_TONE[status], status === "live" && "animate-pulse")}
          />
          <span className="text-foreground text-sm font-medium">{title}</span>
          <span className="sr-only" role="status" data-testid={`${testId}-status`}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {onDisplayChange ? (
            <div
              className="border-border inline-flex overflow-hidden rounded-md border"
              role="group"
              aria-label="Sides shown"
            >
              {DISPLAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.hint}
                  aria-pressed={display === option.value}
                  data-testid={`${testId}-display-${option.value}`}
                  onClick={() => onDisplayChange(option.value)}
                  className={cn(
                    "hover:bg-muted px-2 py-1 text-[11px] transition-colors motion-reduce:transition-none",
                    display === option.value
                      ? "bg-primary text-primary-foreground hover:bg-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {tickSizeOptions && tickSizeOptions.length > 0 && onTickSizeChange ? (
            <Select
              value={tickSize === undefined ? undefined : String(tickSize)}
              onValueChange={(next) => onTickSizeChange(Number(next))}
            >
              <SelectTrigger
                aria-label="Price grouping"
                title="Price grouping — collapse levels onto a coarser tick"
                data-testid={`${testId}-tick-size`}
                className="h-7 w-[7.5rem] text-[11px]"
              >
                {/* The value alone is a bare number with no unit; without this the control reads as an unlabelled input. */}
                <span className="text-muted-foreground/80 shrink-0 text-[10px] tracking-wide uppercase">Group</span>
                <SelectValue placeholder="—" className="font-mono" />
              </SelectTrigger>
              <SelectContent>
                {tickSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)} className="font-mono text-[11px]">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {status === "error" ? (
        <p role="alert" data-testid={`${testId}-error`} className="text-negative px-3 py-8 text-center text-sm">
          {errorMessage ?? "The order book feed failed."}
        </p>
      ) : status === "loading" && isEmpty ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 px-3 py-8 text-sm">
          <Spinner />
          Loading depth…
        </div>
      ) : isEmpty ? (
        <p data-testid={`${testId}-empty`} className="text-muted-foreground px-3 py-8 text-center text-sm">
          {emptyLabel}
        </p>
      ) : (
        <div
          className={cn("py-2 transition-opacity", status === "stale" && "opacity-60")}
          data-testid={`${testId}-ladder`}
        >
          <OrderBookColumnLabels baseAsset={baseAsset} quoteAsset={quoteAsset} />

          {showAsks ? (
            <div role="rowgroup" aria-label="Asks" data-testid={`${testId}-asks`}>
              {askRows.map((row, index) => (
                <OrderBookRow
                  key={row ? `ask-${row.price}` : `ask-blank-${index}`}
                  row={row}
                  side="ask"
                  index={askRows.length - 1 - index}
                  maxTotal={askScale}
                  pricePrecision={pricePrecision}
                  sizePrecision={sizePrecision}
                  previousSize={row ? previousAsks.get(row.price) : undefined}
                  highlightChanges={highlightChanges}
                  onSelectLevel={onSelectLevel}
                  testId={testId}
                />
              ))}
            </div>
          ) : null}

          <OrderBookSeam spread={spread} imbalance={imbalance} pricePrecision={pricePrecision} testId={testId} />

          {showBids ? (
            <div role="rowgroup" aria-label="Bids" data-testid={`${testId}-bids`}>
              {bidRows.map((row, index) => (
                <OrderBookRow
                  key={row ? `bid-${row.price}` : `bid-blank-${index}`}
                  row={row}
                  side="bid"
                  index={index}
                  maxTotal={bidScale}
                  pricePrecision={pricePrecision}
                  sizePrecision={sizePrecision}
                  previousSize={row ? previousBids.get(row.price) : undefined}
                  highlightChanges={highlightChanges}
                  onSelectLevel={onSelectLevel}
                  testId={testId}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function padRows(rows: readonly OrderBookRowData[], count: number): (OrderBookRowData | undefined)[] {
  const visible = rows.slice(0, count);
  if (visible.length >= count) return [...visible];
  return [...visible, ...Array.from({ length: count - visible.length }, () => undefined)];
}
