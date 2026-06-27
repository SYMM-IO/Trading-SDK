"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { DEFAULT_NOTIONAL_CAP_POLLING_MS, useMarkets, useNotionalCapBySymbolId } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { MarketSelect, type MarketSelectItem } from "@symm-frontier/ui/components/market-select";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

/**
 * Solvers-page card for `/notional_cap/{symbolId}` — the solver's per-market
 * available-liquidity read. Defaults to live polling every
 * {@link DEFAULT_NOTIONAL_CAP_POLLING_MS}; toggle the polling button to pause.
 */
export function ReadNotionalCap() {
  const marketsQuery = useMarkets();
  const markets = useMemo(() => getOpenMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);

  const [marketId, setMarketId] = useState("");
  const [polling, setPolling] = useState(true);

  const symbolId = Number(marketId) || 0;
  const query = useNotionalCapBySymbolId({
    symbolId,
    pollingInterval: polling ? DEFAULT_NOTIONAL_CAP_POLLING_MS : false,
    query: { enabled: symbolId > 0 },
  });

  return (
    <MethodCard
      testId="method-getNotionalCap"
      name="getNotionalCapBySymbolId"
      mutability="view"
      description="Fetch the solver's per-market notional cap (available liquidity in dollars)."
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="market" htmlFor="input-notional-cap-market">
          <MarketSelect
            idPrefix="input-notional-cap-market"
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

        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPolling((current) => !current)}
            data-testid="button-notional-cap-toggle-polling"
          >
            {polling ? "Pause polling" : "Resume polling"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={symbolId === 0 || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-notional-cap"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Refreshing…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
        <span className="text-muted-foreground text-xs">
          {polling ? `Auto-refresh every ${Math.round(DEFAULT_NOTIONAL_CAP_POLLING_MS / 1000)}s` : "Polling paused"}
        </span>
      </div>

      <ResultPanel testId="result-getNotionalCap" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useNotionalCapBySymbolId> }) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Select a market to read its notional cap.</ResultNote>;
  }

  const data = query.data;
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="symbolId" value={String(data.symbolId)} mono />
      <DataRow label="symbol" value={data.symbol || "—"} mono />
      <DataRow label="error" value={data.error ?? "—"} mono />
      <DataRow label="price" value={String(data.price)} mono />
      <DataRow label="availableToLong" value={String(data.availableToLong)} mono />
      <DataRow label="availableToShort" value={String(data.availableToShort)} mono />
      <DataRow label="totalCap" value={String(data.totalCap)} mono />
      <DataRow label="used" value={String(data.used)} mono />
      <DataRow label="openInterest" value={String(data.openInterest)} mono />
      <DataRow label="tokenBalance" value={String(data.tokenBalance)} mono />
      <DataRow label="usdcBalance" value={String(data.usdcBalance)} mono />
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
    const label = market.symbol ?? market.name ?? `Market ${market.symbol_id}`;
    const name = market.name && market.name !== label ? market.name : undefined;
    return {
      id,
      label,
      description: name ? name : undefined,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}
