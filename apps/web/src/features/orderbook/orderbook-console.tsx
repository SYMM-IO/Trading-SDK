"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/notifications/socket-status-display";
import { getOrderbookDepthWithin, walkOrderbook } from "@symmio/trading-core";
import { useBinanceOrderbookSource, useLiveOrderbook } from "@symmio/trading-react";
import { MarketSelect } from "@symmio/ui/components/market-select";
import { OrderBook, type OrderBookDisplay, type OrderBookSelectedLevel } from "@symmio/ui/components/order-book";
import { cn } from "@symmio/ui/lib/utils";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useListedMarkets } from "../markets/use-listed-markets";
import { useMajorMarkets } from "../markets/use-major-markets";

/** Row counts the demo offers. Each shows that many bids AND that many asks. */
const ROW_OPTIONS = [5, 10, 15, 20] as const;

/** Half-width of the band the imbalance read is taken over. */
const IMBALANCE_BAND = 0.005;

/** Size, in base units, the sample market order is walked for. */
const IMPACT_SIZE = 5;

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * The orderbook slice end to end: `useBinanceOrderbookSource` builds the source
 * and `useLiveOrderbook` returns a synchronized, grouped, accumulated book that
 * feeds `<OrderBook />` straight from the design system.
 *
 * The two panels beside the ladder are the reason the SDK ships depth rather
 * than just a ladder: `walkOrderbook` and `getOrderbookDepthWithin` are plain
 * functions over the same book, so an execution estimate costs no extra request.
 */
export function OrderbookConsole() {
  const [marketName, setMarketName] = useState("BTCUSDT");
  const [display, setDisplay] = useState<OrderBookDisplay>("both");
  const [tickSize, setTickSize] = useState<number>();
  const [picked, setPicked] = useState<OrderBookSelectedLevel>();
  const [rows, setRows] = useState<number>(15);

  const source = useBinanceOrderbookSource();

  /** Rasa's markets — the majors this source is here to stream books for. */
  const majors = useMajorMarkets();
  const { items: marketItems, isLoading: isFilteringMarkets } = useListedMarkets({
    source,
    names: majors.names,
    selected: marketName,
  });

  /**
   * `levels` is deliberately not passed: the hook derives how many raw levels
   * to stream from `rows` and the active grouping, so a coarse tick still fills
   * the ladder instead of leaving it half-empty.
   */
  const book = useLiveOrderbook({ source, marketName, rows, tickSize });

  /** Grouping options are per-market; a stale choice would silently do nothing. */
  const activeTickSize = book.tickSizeOptions.includes(tickSize ?? Number.NaN) ? tickSize : book.tickSize;

  const impact = useMemo(
    () => (book.orderbook ? walkOrderbook(book.orderbook, "buy", IMPACT_SIZE) : undefined),
    [book.orderbook],
  );

  const depth = useMemo(
    () => (book.orderbook ? getOrderbookDepthWithin(book.orderbook, IMBALANCE_BAND) : undefined),
    [book.orderbook],
  );

  const status = book.error
    ? "error"
    : book.isResyncing
      ? "stale"
      : book.isLoading
        ? "loading"
        : book.orderbook
          ? "live"
          : "idle";

  return (
    <MethodCard
      testId="method-useLiveOrderbook"
      name="useLiveOrderbook"
      mutability="view"
      description="A continuously synchronized order book from Binance USD-M futures, grouped onto a tick and accumulated. The SDK verifies every update chains onto the last and rebuilds from a fresh snapshot when one does not."
      wide
    >
      <div className="flex flex-wrap items-center gap-2">
        <MarketSelect
          idPrefix="orderbook-market"
          value={marketName}
          items={marketItems}
          onValueChange={(next) => {
            /** `MarketSelect` clears to `""`; keep the ladder on its market instead. */
            if (!next) return;
            setMarketName(next);
            /** Tick ladders are per-market — carrying one over would be meaningless. */
            setTickSize(undefined);
            setPicked(undefined);
          }}
          placeholder={majors.isLoading || isFilteringMarkets ? "Loading markets…" : "Select a market…"}
          searchPlaceholder="Search market…"
          emptyLabel="No markets available."
          emptyResultsLabel="No markets match this search."
          clearLabel="Clear market"
          className="w-56"
        />

        <span className="inline-flex items-center gap-2 text-xs">
          <StatusDot tone={socketStatusTone(book.status)} pulse={book.status === "open"} />
          {socketStatusLabel(book.status)}
        </span>

        <div
          className="border-border inline-flex overflow-hidden rounded-md border"
          role="group"
          aria-label="Rows per side"
        >
          {ROW_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={rows === option}
              title={`Show ${option} bids and ${option} asks`}
              data-testid={`button-orderbook-rows-${option}`}
              onClick={() => setRows(option)}
              className={cn(
                "hover:bg-muted px-2.5 py-1 text-xs transition-colors motion-reduce:transition-none",
                rows === option ? "bg-primary text-primary-foreground hover:bg-primary" : "text-muted-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        {book.resyncReason ? (
          <span
            className="text-muted-foreground ml-auto font-mono text-xs"
            data-testid="method-useLiveOrderbook-resync"
          >
            last rebuild: {book.resyncReason}
          </span>
        ) : null}
      </div>

      {majors.error ? (
        <ResultError
          testId="method-useLiveOrderbook-markets-error"
          kind={majors.error.kind}
          message={`Rasa's market list is unavailable, so the picker only offers the current market: ${majors.error.message}`}
        />
      ) : null}

      {book.isUnsupported ? (
        <ResultNote testId="method-useLiveOrderbook-unlisted">
          Binance USD-M futures does not carry {marketName}, so there is no book to stream. Pick a major, or point the
          source at a venue that lists this market.
        </ResultNote>
      ) : null}

      {book.error ? (
        <ResultError kind={book.error.kind} message={book.error.message} testId="method-useLiveOrderbook-error" />
      ) : null}

      <div className="grid gap-4 @2xl/console:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <OrderBook
          bids={book.bids}
          asks={book.asks}
          spread={book.spread}
          imbalance={depth?.imbalance}
          baseAsset={book.symbol?.baseAsset}
          quoteAsset={book.symbol?.quoteAsset}
          pricePrecision={book.symbol?.pricePrecision ?? 2}
          sizePrecision={book.symbol?.sizePrecision ?? 4}
          rows={rows}
          display={display}
          onDisplayChange={setDisplay}
          tickSize={activeTickSize}
          tickSizeOptions={book.tickSizeOptions}
          onTickSizeChange={setTickSize}
          onSelectLevel={setPicked}
          status={status}
          errorMessage={book.error?.message}
          title={marketName}
          testId="orderbook-ladder"
        />

        <div className="flex flex-col gap-3">
          <DerivedPanel
            title="Selected level"
            hint="Click any row — this is where a real UI would prefill a limit order."
          >
            {picked ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                <dt className="text-muted-foreground">Side</dt>
                <dd className={picked.side === "bid" ? "text-positive" : "text-negative"}>{picked.side}</dd>
                <dt className="text-muted-foreground">Price</dt>
                <dd className="tabular-nums">{picked.price}</dd>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="tabular-nums">{picked.size}</dd>
                <dt className="text-muted-foreground">Cumulative</dt>
                <dd className="tabular-nums">{picked.total}</dd>
              </dl>
            ) : (
              <p className="text-muted-foreground text-xs">No level selected.</p>
            )}
          </DerivedPanel>

          <DerivedPanel
            title={`Market buy · ${IMPACT_SIZE} ${book.symbol?.baseAsset ?? "base"}`}
            hint="walkOrderbook — the cost of crossing the book, from the same data."
          >
            {impact && impact.averagePrice !== undefined ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                <dt className="text-muted-foreground">Avg. fill</dt>
                <dd className="tabular-nums">{impact.averagePrice.toFixed(book.symbol?.pricePrecision ?? 2)}</dd>
                <dt className="text-muted-foreground">Slippage</dt>
                <dd className="tabular-nums">{impact.slippageBps.toFixed(2)} bps</dd>
                <dt className="text-muted-foreground">Levels</dt>
                <dd className="tabular-nums">{impact.levelsConsumed}</dd>
                <dt className="text-muted-foreground">Notional</dt>
                <dd className="tabular-nums">{formatUsd(impact.filledQuote)}</dd>
                {impact.partial ? (
                  <>
                    <dt className="text-warning">Shortfall</dt>
                    <dd className="text-warning tabular-nums">
                      {(impact.requestedSize - impact.filledSize).toFixed(3)} unfilled
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground text-xs">Waiting for depth.</p>
            )}
          </DerivedPanel>

          <DerivedPanel
            title={`Depth within ±${(IMBALANCE_BAND * 100).toFixed(1)}%`}
            hint="getOrderbookDepthWithin — the rail under the spread is this number."
          >
            {depth ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                <dt className="text-muted-foreground">Bid notional</dt>
                <dd className="text-positive tabular-nums">{formatUsd(depth.bidQuote)}</dd>
                <dt className="text-muted-foreground">Ask notional</dt>
                <dd className="text-negative tabular-nums">{formatUsd(depth.askQuote)}</dd>
                <dt className="text-muted-foreground">Imbalance</dt>
                <dd className="tabular-nums">
                  {(depth.imbalance * 100).toFixed(1)}% {depth.imbalance >= 0 ? "bid" : "ask"}
                </dd>
              </dl>
            ) : (
              <p className="text-muted-foreground text-xs">Waiting for depth.</p>
            )}
          </DerivedPanel>
        </div>
      </div>
    </MethodCard>
  );
}

interface DerivedPanelProps {
  title: string;
  hint: string;
  children: React.ReactNode;
}

function DerivedPanel({ title, hint, children }: DerivedPanelProps) {
  return (
    <div className="ring-border/70 bg-card flex flex-col gap-2 rounded-lg p-3 ring-1">
      <div>
        <h3 className="text-foreground text-xs font-medium">{title}</h3>
        <p className="text-muted-foreground/80 text-[11px]">{hint}</p>
      </div>
      {children}
    </div>
  );
}
