"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/notifications/socket-status-display";
import { SymmioSupportedChainId, type CandleResolution } from "@symmio/trading-core";
import {
  useCandleHistory,
  useCandleStream,
  useEnigmaPriceServiceSymbolsInfo,
  useLowcapCandleSource,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { MarketSelect } from "@symmio/ui/components/market-select";
import { Spinner } from "@symmio/ui/components/spinner";
import { Switch } from "@symmio/ui/components/switch";
import { cn } from "@symmio/ui/lib/utils";
import { useState, type ReactNode } from "react";
import { MethodCard } from "../inspector/method-card";
import { CandleChart } from "./candle-chart";

// Initial viewport sizes only. Calendar alignment and paging belong to the source.
const VIEWPORT_MS: Partial<Record<CandleResolution, number>> = {
  "1m": 60_000,
  "5m": 300_000,
  "10m": 600_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "6h": 21_600_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
  "1M": 2_678_400_000,
};
const CHAIN_ID = SymmioSupportedChainId.ARBITRUM;

/** Exercise price-service history and provisional live candles through the public React SDK. */
export function LowcapCandlesConsole() {
  const [selected, setSelected] = useState("");
  const [resolution, setResolution] = useState<CandleResolution>("1h");
  const [includeFlat, setIncludeFlat] = useState(false);
  const source = useLowcapCandleSource({ chainId: CHAIN_ID, solverId: "enigma", includeFlat });
  const symbols = useEnigmaPriceServiceSymbolsInfo({ chainId: CHAIN_ID, query: { staleTime: 60_000 } });
  const items = [...(symbols.data ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((symbol) => ({
      id: symbol.name,
      label: symbol.name,
      description: symbol.address,
    }));
  const marketName = selected || items[0]?.id || "";

  const controls = (
    <>
      <MarketSelect
        idPrefix="lowcap-candles-market"
        value={marketName}
        items={items}
        onValueChange={(value) => {
          if (value) setSelected(value);
        }}
        placeholder={symbols.isLoading ? "Loading markets…" : "Select a lowcap market…"}
        searchPlaceholder="Search full market name…"
        emptyLabel="No listed markets."
        emptyResultsLabel="No matching markets."
        clearLabel="Clear market"
        className="w-56 max-w-full"
      />
      <div
        className="border-border inline-flex max-w-full overflow-x-auto rounded-md border"
        role="group"
        aria-label="Lowcap resolution"
      >
        {source.supportedResolutions.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={resolution === value}
            onClick={() => setResolution(value)}
            className={cn(
              "h-auto rounded-none border-0 px-2.5 py-1.5 text-xs font-normal transition-colors motion-reduce:transition-none",
              resolution === value
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary"
                : "text-muted-foreground",
            )}
          >
            {value}
          </Button>
        ))}
      </div>
      <label className="inline-flex shrink-0 items-center gap-2 text-xs">
        <Switch checked={includeFlat} onCheckedChange={setIncludeFlat} aria-label="Include flat candles" />
        Include flat candles
      </label>
    </>
  );

  return (
    <MethodCard
      testId="method-useLowcapCandleSource"
      name="useLowcapCandleSource"
      mutability="view"
      wide
      description="Lowcap price-service OHLCV history with USD volume. Choose a market and timeframe, then pan or zoom toward older dates to load more history."
    >
      {symbols.error ? <ResultError kind={symbols.error.kind} message={symbols.error.message} /> : null}
      {marketName ? (
        <LowcapHistory
          key={`${source.id}:${marketName}:${resolution}`}
          source={source}
          marketName={marketName}
          resolution={resolution}
          controls={controls}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          {symbols.isLoading ? <Spinner className="ml-auto size-3.5" /> : null}
        </div>
      )}
      <ResultNote>
        OHLCV is available on production and staging. SDK config in the header selects the price-service environment for
        this card.
      </ResultNote>
    </MethodCard>
  );
}

interface Props {
  source: ReturnType<typeof useLowcapCandleSource>;
  marketName: string;
  resolution: CandleResolution;
  controls: ReactNode;
}

function LowcapHistory({ source, marketName, resolution, controls }: Props) {
  const windowMs = (VIEWPORT_MS[resolution] ?? 3_600_000) * 300;
  const [range] = useState(() => {
    const to = Date.now();
    return { from: to - windowMs, to };
  });
  const [streaming, setStreaming] = useState(false);
  const history = useCandleHistory({
    source,
    marketName,
    resolution,
    ...range,
    followLatest: true,
    query: { staleTime: 0, refetchOnWindowFocus: false, retry: 1 },
  });
  const data = history.data;

  const stream = useCandleStream({
    source,
    marketName,
    resolution,
    enabled: streaming,
    onReset: (range) => {
      void history.refresh(range);
    },
  });
  const candles = data?.candles ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {controls}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void history.refresh();
          }}
        >
          Refresh
        </Button>
        <Button type="button" size="sm" onClick={() => setStreaming((value) => !value)}>
          {streaming ? "Stop stream" : "Start stream"}
        </Button>
        <span className="inline-flex items-center gap-2 text-xs">
          <StatusDot tone={socketStatusTone(stream.status)} pulse={stream.status === "open"} />
          {streaming ? socketStatusLabel(stream.status) : "Idle"}
        </span>
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-2 text-xs tabular-nums">
          {history.isFetching ? (
            <Spinner className="size-3.5" />
          ) : history.error ? (
            "History unavailable"
          ) : (
            `${candles.length} bars`
          )}
          <span>· Volume: USD</span>
        </span>
      </div>
      {history.error ? <ResultError kind={history.error.kind} message={history.error.message} /> : null}
      {stream.error ? <ResultError kind={stream.error.kind} message={stream.error.message} /> : null}
      <CandleChart
        candles={candles}
        liveCandle={streaming ? stream.candle : null}
        pricePrecision={8}
        onLoadOlder={() => {
          void history.loadOlder();
        }}
        emptyLabel={
          history.isLoading
            ? "Loading candles…"
            : history.error
              ? "Candle history could not be loaded."
              : data?.noMoreData
                ? "No candle history available."
                : "No candles in this window. Drag right or zoom out to look farther back."
        }
      />
      <ResultNote>
        Price basis: price service. Volume is quoted in USD and is refreshed through OHLCV; price ticks do not carry
        volume.
        {data && !history.error
          ? data.noMoreData
            ? " The service confirms there is no older history."
            : " Pan or zoom toward older dates to load another window. An empty window does not establish the start of history."
          : null}
      </ResultNote>
    </>
  );
}
