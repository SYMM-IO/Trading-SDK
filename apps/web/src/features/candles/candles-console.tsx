"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/notifications/socket-status-display";
import { useBinanceCandleSource, useCandleStream, useCandles } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { MarketSelect } from "@symmio/ui/components/market-select";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useListedMarkets } from "../markets/use-listed-markets";
import { useMajorMarkets } from "../markets/use-major-markets";
import { CandleChart } from "./candle-chart";
import { DEFAULT_BAR_COUNT, RESOLUTION_OPTIONS, toCandleRange, type PickerResolution } from "./resolution-options";

/**
 * The candles slice end to end: `useBinanceCandleSource` builds the source,
 * `useCandles` loads history, and `useCandleStream` merges live bars onto it.
 *
 * The chart library is `lightweight-charts`, chosen here only to prove the
 * point — the SDK hooks below have no idea which library is rendering them.
 */
export function CandlesConsole() {
  const [marketName, setMarketName] = useState("BTCUSDT");
  const [resolution, setResolution] = useState<PickerResolution>("1m");
  const [streaming, setStreaming] = useState(false);

  const source = useBinanceCandleSource();

  /**
   * The range is pinned in state, not derived from a live `Date.now()`: it is
   * part of the query key, so a moving value would mint a new cache entry on
   * every render. "Refresh" re-pins it.
   */
  const [anchor, setAnchor] = useState(() => Date.now());
  const range = useMemo(() => toCandleRange(resolution, anchor), [resolution, anchor]);

  /** Rasa's markets — the majors this source is here to chart. */
  const majors = useMajorMarkets();
  const { items: marketItems, isLoading: isFilteringMarkets } = useListedMarkets({
    source,
    names: majors.names,
    selected: marketName,
  });

  /**
   * `getSymbol` resolving to `undefined` is the SDK's "this source does not
   * carry that market" signal, and it is the check that has to come first:
   * asking Binance for a market it never listed is a 400, not an empty series,
   * so without this the page would show a raw HTTP error where the honest
   * answer is "wrong source for this market".
   */
  const [symbolState, setSymbolState] = useState<"loading" | "supported" | "unsupported">("loading");
  const [pricePrecision, setPricePrecision] = useState(2);

  useEffect(() => {
    let cancelled = false;
    setSymbolState("loading");
    source
      .getSymbol(marketName)
      .then((symbol) => {
        if (cancelled) return;
        setSymbolState(symbol ? "supported" : "unsupported");
        if (symbol) setPricePrecision(symbol.pricePrecision);
      })
      .catch(() => {
        /** Treat a metadata failure as "try anyway" rather than blocking the chart. */
        if (!cancelled) setSymbolState("supported");
      });
    return () => {
      cancelled = true;
    };
  }, [source, marketName]);

  const isSupported = symbolState === "supported";

  const history = useCandles({
    source,
    marketName,
    resolution,
    from: range.from,
    to: range.to,
    limit: DEFAULT_BAR_COUNT,
    query: { enabled: isSupported },
  });

  const stream = useCandleStream({
    source,
    marketName,
    resolution,
    enabled: streaming && isSupported,
    /** A reconnect gap means bars were missed — reload history rather than splice. */
    onReset: () => setAnchor(Date.now()),
  });

  const candles = history.data?.candles ?? [];
  const isUnlisted =
    symbolState === "unsupported" || (history.isSuccess && history.data?.noMoreData === true && candles.length === 0);

  return (
    <MethodCard
      testId="method-useCandles"
      name="useCandles + useCandleStream"
      mutability="view"
      description="Load historical bars from a CandleSource and merge live updates onto them. The source here is Binance USD-M futures; the chart is lightweight-charts, which the SDK knows nothing about."
      wide
    >
      <div className="flex flex-wrap items-center gap-2">
        <MarketSelect
          idPrefix="candles-market"
          value={marketName}
          items={marketItems}
          onValueChange={(next) => {
            /** `MarketSelect` clears to `""`; keep the chart on its current market instead. */
            if (next) setMarketName(next);
          }}
          placeholder={majors.isLoading || isFilteringMarkets ? "Loading markets…" : "Select a market…"}
          searchPlaceholder="Search market…"
          emptyLabel="No markets available."
          emptyResultsLabel="No markets match this search."
          clearLabel="Clear market"
          className="w-56"
        />

        <div
          className="border-border inline-flex overflow-hidden rounded-md border"
          role="group"
          aria-label="Resolution"
        >
          {RESOLUTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setResolution(option.value)}
              aria-pressed={resolution === option.value}
              data-testid={`button-candles-resolution-${option.value}`}
              className={cn(
                "hover:bg-muted px-2.5 py-1.5 text-xs transition-colors motion-reduce:transition-none",
                resolution === option.value
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setAnchor(Date.now())}
          data-testid="button-candles-refresh"
        >
          Refresh
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={!isSupported}
          onClick={() => setStreaming((prev) => !prev)}
          data-testid="button-candles-stream"
        >
          {streaming ? "Stop stream" : "Start stream"}
        </Button>

        <span className="inline-flex items-center gap-2 text-xs">
          <StatusDot tone={socketStatusTone(stream.status)} pulse={stream.status === "open"} />
          {streaming ? socketStatusLabel(stream.status) : "Idle"}
        </span>

        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {history.isFetching ? <Spinner className="size-3.5" /> : `${candles.length} bars`}
        </span>
      </div>

      {majors.error ? (
        <ResultError
          testId="method-useCandles-markets-error"
          kind={majors.error.kind}
          message={`Rasa's market list is unavailable, so the picker only offers the current market: ${majors.error.message}`}
        />
      ) : null}

      {history.error ? (
        <ResultError testId="method-useCandles-error" kind={history.error.kind} message={history.error.message} />
      ) : null}

      {isUnlisted ? (
        <ResultNote testId="method-useCandles-unlisted">
          This source has no bars for <code>{marketName}</code>. <code>getSymbol</code> did not resolve it, which is how
          a <code>CandleSource</code> reports a market it does not carry — the same check that filters the picker above
          down to what Binance lists. Lowcaps have no listing at all; those chart from their liquidity pool instead, in
          the card below.
        </ResultNote>
      ) : null}

      {stream.error ? (
        <ResultError testId="method-useCandles-stream-error" kind={stream.error.kind} message={stream.error.message} />
      ) : null}

      <CandleChart
        candles={candles}
        liveCandle={streaming ? stream.candle : null}
        pricePrecision={pricePrecision}
        emptyLabel={
          isUnlisted ? undefined : symbolState === "loading" || history.isLoading ? "Loading bars…" : "No bars"
        }
      />

      <ResultNote testId="method-useCandles-basis">
        Prices are Binance&apos;s perp mark (<code>priceBasis: &quot;reference-exchange&quot;</code>), not the SYMMIO
        solver mark a trade settles against.
      </ResultNote>
    </MethodCard>
  );
}
