"use client";

import { Combobox } from "@/components/combobox";
import { MicroLabel } from "@/components/panel";
import { EmptyState, Skeleton } from "@/components/table";
import type { PrismMarket } from "@/features/markets/types";
import { cn } from "@/lib/cn";
import { formatDepth, formatPrice } from "@/lib/format";
import type { OrderbookDepthLevel } from "@symmio/trading-core";
import { useBinanceOrderbookSource, useLiveOrderbook } from "@symmio/trading-react";
import { useCallback, useRef, useState } from "react";
import { PoolStats } from "./pool-stats";

export interface OrderbookPanelProps {
  market: PrismMarket;
  /** Clicking a level fills the ticket's limit price. */
  onPickPrice?: (price: number) => void;
}

/**
 * Depth ladder for the selected market.
 *
 * Like candles, the SDK's shipped order-book source is Binance, so this serves
 * the majors deployment. Lowcaps quote from a liquidity pool with no public
 * book — saying so is more useful than rendering an empty ladder.
 */
export function OrderbookPanel({ market: entry, onPickPrice }: OrderbookPanelProps) {
  /* Routed on how the market is priced, not on which solver serves it: a
     pool-traded market has no resting book, but it does have pool vitals worth
     showing, which is strictly more useful than an empty ladder. */
  if (entry.market.kind === "enigma") {
    return <PoolStats market={entry} />;
  }

  return <BinanceOrderbook market={entry} onPickPrice={onPickPrice} />;
}

/** Fallback row height, used only until a row has been rendered and measured. */
const ASSUMED_ROW_HEIGHT = 24;

/** The Binance-backed ladder. Split out so its hooks only run when supported. */
function BinanceOrderbook({ market: entry, onPickPrice }: OrderbookPanelProps) {
  const source = useBinanceOrderbookSource();
  const [tickSize, setTickSize] = useState<number | undefined>(undefined);
  const rows = useLadderRows();

  const book = useLiveOrderbook({
    source,
    marketName: entry.market.name,
    rows: rows.count,
    tickSize,
  });

  /* A dropped socket leaves the last good ladder on screen. Saying so is the
     difference between "the market is quiet" and "these numbers are stale". */
  const isStale = book.status !== "open" && !book.isLoading;

  if (book.isUnsupported) {
    return (
      <EmptyState
        className="my-auto"
        title="Market not listed on the depth feed"
        body={`${entry.market.name} has no Binance USD-M order book.`}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2">
        <MicroLabel>Order book</MicroLabel>
        {book.isResyncing ? (
          <span className="prism-pulse text-2xs text-warn" title={book.resyncReason ?? undefined}>
            resync
          </span>
        ) : isStale ? (
          <span className="text-2xs text-warn">{book.status}</span>
        ) : null}
        <Combobox
          label="Price grouping"
          size="xs"
          align="end"
          menuWidth={112}
          className="ml-auto"
          value={tickSize === undefined ? "" : String(tickSize)}
          options={[
            { value: "", label: "auto" },
            ...(book.tickSizeOptions ?? []).map((option) => ({ value: String(option), label: String(option) })),
          ]}
          onChange={(next) => setTickSize(next ? Number(next) : undefined)}
        />
      </div>

      <div className="grid grid-cols-[minmax(70px,1fr)_minmax(60px,1fr)] gap-2 px-4 py-1.5">
        <MicroLabel>Price</MicroLabel>
        <MicroLabel className="text-right">Size</MicroLabel>
      </div>

      {book.error ? <p className="px-4 pb-1 text-2xs text-warn">{book.error.message}</p> : null}

      {book.isLoading ? (
        <div className="flex flex-col gap-1.5 px-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-full" />
          ))}
        </div>
      ) : (
        <div
          ref={rows.ref}
          className={cn(
            "flex min-h-0 flex-1 flex-col justify-center overflow-y-auto transition-opacity duration-[var(--dur-base)]",
            isStale ? "opacity-50" : null,
          )}
        >
          <Ladder levels={book.asks} side="ask" max={book.maxTotal} onPick={onPickPrice} />

          {/* The mid, not the best bid. `OrderbookSpread` computes it from the
              ungrouped book, along with the relative spread the raw number
              cannot convey on its own. */}
          <div data-ladder-spread className="my-1 flex items-baseline gap-2 border-y border-line-subtle px-4 py-2">
            <span className="tnum text-lg font-semibold text-fg-0">
              {book.spread ? formatPrice(book.spread.midPrice) : "—"}
            </span>
            <span className="tnum ml-auto text-2xs text-fg-3">
              spread {book.spread ? `${formatPrice(book.spread.spread)} · ${book.spread.spreadBps.toFixed(1)}bp` : "—"}
            </span>
          </div>

          <Ladder levels={book.bids} side="bid" max={book.maxTotal} onPick={onPickPrice} />
        </div>
      )}

      {/* The ladder is a reference exchange's resting liquidity, not the depth a
          SYMMIO order executes against — the solver's mark is what settles. It
          seeds the limit price because it is the best public read on where the
          market is, not because the fill comes from it. */}
      <p className="shrink-0 border-t border-line-subtle px-4 py-1.5 text-2xs text-fg-3">
        Binance USD-M depth · click a level to set your limit price
      </p>
    </div>
  );
}

interface LadderProps {
  levels: readonly OrderbookDepthLevel[];
  side: "bid" | "ask";
  max: number;
  onPick?: (price: number) => void;
}

/**
 * How many levels a side of the ladder can show at the panel's current height.
 *
 * The chart, and therefore the book beside it, is user-resizable, so a fixed
 * row count is wrong at every height but one: too many rows overflow a short
 * panel and clip the spread, too few leave the ladder floating in space.
 */
function useLadderRows() {
  const [count, setCount] = useState(8);
  const observerRef = useRef<ResizeObserver | null>(null);

  /* A callback ref rather than an object ref: the ladder only mounts once the
     first book arrives, so an effect keyed on `[]` would run while the node is
     still null and never observe anything. */
  const ref = useCallback((container: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!container) return;

    function fit() {
      /* Measured, not assumed. A row's height depends on the font that actually
         loaded and on the tokens in force, and guessing it wrong by two pixels
         is what clips the top of the book — the one artefact that makes a ladder
         look broken rather than merely tight. */
      const row = container?.querySelector<HTMLElement>("[data-ladder-row]");
      const rowHeight = row?.getBoundingClientRect().height || ASSUMED_ROW_HEIGHT;
      const spread = container?.querySelector<HTMLElement>("[data-ladder-spread]");
      const spreadHeight = spread?.getBoundingClientRect().height ?? 0;

      const available = (container?.clientHeight ?? 0) - spreadHeight;
      const perSide = Math.floor(available / 2 / rowHeight);
      setCount(Math.max(4, Math.min(40, perSide)));
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    observerRef.current = observer;
  }, []);

  return { ref, count };
}

/** One side of the ladder. The depth bar is the only gradient-free fill here. */
function Ladder({ levels, side, max, onPick }: LadderProps) {
  const rows = side === "ask" ? [...levels].reverse() : levels;

  return (
    <div className="flex flex-col">
      {rows.map((level) => (
        <button
          key={level.price}
          data-ladder-row
          type="button"
          onClick={() => onPick?.(level.price)}
          className="relative grid cursor-pointer grid-cols-[minmax(70px,1fr)_minmax(60px,1fr)] gap-2 px-4 py-[3px] text-left transition-colors duration-[var(--dur-instant)] hover:bg-bg-2"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 right-0"
            style={{
              width: max > 0 ? `${Math.min(100, (level.total / max) * 100)}%` : "0%",
              background: side === "bid" ? "var(--long-bg)" : "var(--short-bg)",
            }}
          />
          <span
            className="tnum relative text-sm"
            style={{ color: side === "bid" ? "var(--long-500)" : "var(--short-500)" }}
          >
            {formatPrice(level.price)}
          </span>
          <span className="tnum relative text-right text-sm text-fg-2">{formatDepth(level.size)}</span>
        </button>
      ))}
    </div>
  );
}
