"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useLockedParams, useMarkets } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Input } from "@theoldvarorg/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@theoldvarorg/ui/components/market-select";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useEffect, useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

export function ReadLockedParams() {
  const marketsQuery = useMarkets();
  const markets = useMemo(() => getOpenMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);
  const [marketId, setMarketId] = useState("");
  const [leverage, setLeverage] = useState("1");

  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbol_id) === marketId),
    [marketId, markets],
  );
  const maxLeverage = getMaxLeverage(selectedMarket);
  const validLeverage = parsePositiveNumber(leverage);
  const lockedParamsSymbol = selectedMarket ? getLockedParamsSymbol(selectedMarket) : undefined;
  const query = useLockedParams({
    symbol: lockedParamsSymbol ?? "",
    leverage: validLeverage ?? 0,
    query: { enabled: false },
  });

  useEffect(() => {
    if (!selectedMarket) return;
    setLeverage((current) => String(clampLeverage(Number(current), maxLeverage)));
  }, [maxLeverage, selectedMarket]);

  return (
    <MethodCard
      testId="method-getLockedParams"
      name="getLockedParams"
      mutability="view"
      description="Fetch solver locked params for a selected market and leverage."
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(140px,180px)]">
        <Field label="market" htmlFor="input-locked-params-market">
          <MarketSelect
            idPrefix="input-locked-params-market"
            value={marketId}
            items={marketItems}
            onValueChange={setMarketId}
            placeholder={marketsQuery.isLoading ? "Loading markets..." : "Select a market..."}
            disabled={marketsQuery.isLoading}
            searchPlaceholder="Search symbol, name, or ID..."
            emptyLabel="No open Enigma markets."
            emptyResultsLabel="No markets match this search."
            clearLabel="Clear market"
          />
        </Field>

        <Field
          label="leverage"
          htmlFor="input-locked-params-leverage"
          hint={selectedMarket ? `Max ${maxLeverage}x.` : "Select a market first."}
        >
          <Input
            id="input-locked-params-leverage"
            value={leverage}
            onChange={(event) => setLeverage(event.target.value)}
            placeholder="1"
            inputMode="decimal"
            aria-invalid={leverage.length > 0 && validLeverage === undefined}
            data-testid="input-locked-params-leverage"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!lockedParamsSymbol || !validLeverage || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-locked-params"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Reading...
            </>
          ) : (
            "Read locked params"
          )}
        </Button>
        {lockedParamsSymbol ? (
          <span className="text-muted-foreground font-mono text-xs">{lockedParamsSymbol}</span>
        ) : null}
      </div>

      <ResultPanel testId="result-getLockedParams" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useLockedParams> }) {
  if (query.isFetching) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading...
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Select a market and leverage to read locked params.</ResultNote>;
  }

  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="cva" value={query.data.cva} mono copyValue={query.data.cva} />
      <DataRow label="lf" value={query.data.lf} mono copyValue={query.data.lf} />
      <DataRow label="partyAmm" value={query.data.partyAmm} mono copyValue={query.data.partyAmm} />
      <DataRow label="partyBmm" value={query.data.partyBmm} mono copyValue={query.data.partyBmm} />
      <DataRow label="leverage" value={query.data.leverage} mono copyValue={query.data.leverage} />
    </DataList>
  );
}

function getOpenMarkets(markets: Market[]): Market[] {
  return markets
    .filter((market) => market.symbol_id !== undefined && (market.state === 2 || market.state === 3))
    .sort((a, b) => (a.symbol ?? a.name ?? "").localeCompare(b.symbol ?? b.name ?? ""));
}

function toMarketSelectItems(markets: Market[]): MarketSelectItem[] {
  return markets.map((market) => {
    const id = String(market.symbol_id);
    const label = getMarketLabel(market);
    const name = market.name && market.name !== label ? market.name : undefined;

    return {
      id,
      label,
      description: name ? `${name} · max ${market.max_leverage ?? "1"}x` : `Max ${market.max_leverage ?? "1"}x`,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}

function getMarketLabel(market: Market): string {
  return market.symbol ?? market.name ?? `Market ${market.symbol_id}`;
}

function getLockedParamsSymbol(market: Market): string {
  return market.name ?? market.symbol ?? String(market.symbol_id);
}

function getMaxLeverage(market?: Market): number {
  if (!market) return 1;
  const parsed = Math.floor(Number(market.max_leverage ?? 1));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function clampLeverage(value: number, maxLeverage: number): number {
  return Math.max(1, Math.min(maxLeverage, Math.floor(value || 1)));
}

function parsePositiveNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
