"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import { useEnigmaPriceByName, useMarkets } from "@symm-frontier/react";
import { MarketSelect, type MarketSelectItem } from "@symm-frontier/ui/components/market-select";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

/**
 * Price Service page card: pick a market from the solver's markets list and
 * stream just its mark price. Backed by `useEnigmaPriceByName`, which only
 * re-renders when this symbol's price actually changes.
 */
export function WatchEnigmaPriceByMarket() {
  const marketsQuery = useMarkets();
  const markets = useMemo(() => sortMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const items = useMemo(() => toMarketSelectItems(markets), [markets]);
  console.log("market", marketsQuery.data, items);
  const [marketId, setMarketId] = useState("");
  const selectedMarket = useMemo(() => markets.find((m) => String(m.symbol_id) === marketId), [markets, marketId]);
  const name = selectedMarket?.name;

  return (
    <MethodCard
      testId="method-watchEnigmaPriceByMarket"
      name="watchEnigmaPriceByName"
      mutability="view"
      description="Pick a solver market and stream just its live mark price. The hook only re-renders when this market's price changes."
      wide
    >
      <MarketSelect
        idPrefix="watch-enigma-price-by-market"
        value={marketId}
        items={items}
        onValueChange={setMarketId}
        placeholder={marketsQuery.isLoading ? "Loading markets…" : "Select a market…"}
        disabled={marketsQuery.isLoading}
        searchPlaceholder="Search symbol, name, or ID…"
        emptyLabel="No solver markets available."
        emptyResultsLabel="No markets match this search."
        clearLabel="Clear market"
      />

      {name ? (
        <MarketPriceStream name={name} testId="result-watchEnigmaPriceByMarket" />
      ) : (
        <ResultNote testId="result-watchEnigmaPriceByMarket-idle">
          Pick a market to start streaming its price.
        </ResultNote>
      )}
    </MethodCard>
  );
}

function MarketPriceStream({ name, testId }: { name: string; testId: string }) {
  const { markPrice, status, error } = useEnigmaPriceByName({ name });

  return (
    <>
      <div className="flex items-center gap-2 text-xs">
        <StatusDot tone={socketStatusTone(status)} pulse={status === "open"} />
        <span className="text-muted-foreground">{socketStatusLabel(status)}</span>
      </div>

      {error ? (
        <ResultError testId={`${testId}-error`} kind={error.kind} message={error.message} />
      ) : markPrice === null ? (
        <ResultNote testId={`${testId}-waiting`} loading>
          Waiting for the first tick for <span className="font-mono">{name}</span>…
        </ResultNote>
      ) : (
        <div
          data-testid={`${testId}-data`}
          className="border-border bg-card/40 flex items-baseline justify-between gap-4 rounded-xl border px-4 py-3"
        >
          <span className="text-muted-foreground font-mono text-xs">{name}</span>
          <span className="text-foreground font-mono text-2xl tabular-nums">{markPrice}</span>
        </div>
      )}
    </>
  );
}

function sortMarkets(markets: Market[]): Market[] {
  return [...markets].sort((a, b) => (a.symbol ?? a.name ?? "").localeCompare(b.symbol ?? b.name ?? ""));
}

function toMarketSelectItems(markets: Market[]): MarketSelectItem[] {
  return markets.map((market) => {
    const id = String(market.symbol_id);
    const label = market.symbol ?? market.name ?? `Market ${market.symbol_id}`;
    const name = market.name && market.name !== label ? market.name : undefined;
    return {
      id,
      label,
      description: name,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}
