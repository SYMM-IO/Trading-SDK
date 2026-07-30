"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import type { MarketVolume, RasaMarketInfoRow } from "@symmio/trading-core";
import { useMarketInfo } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatCompactCurrency } from "@symmio/utils";
import { useState } from "react";

const ENIGMA_COLUMNS: DataTableColumn<MarketVolume>[] = [
  {
    id: "symbol",
    header: "Market",
    cell: (row) => row.symbol,
    sortAccessor: (row) => row.symbol,
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "volume",
    header: "24h Volume",
    align: "end",
    cell: (row) => formatUsd(row.tradingVolume),
    sortAccessor: (row) => row.tradingVolume,
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "lifetime",
    header: "Lifetime Value",
    align: "end",
    cell: (row) => formatUsd(row.lifetimeValue),
    sortAccessor: (row) => row.lifetimeValue,
    cellClassName: "text-muted-foreground font-mono",
  },
];

const RASA_COLUMNS: DataTableColumn<RasaMarketInfoRow>[] = [
  {
    id: "symbol",
    header: "Market",
    cell: (row) => row.symbol,
    sortAccessor: (row) => row.symbol,
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "price",
    header: "Price",
    align: "end",
    cell: (row) => formatUsd(row.price),
    sortAccessor: (row) => row.price,
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "change",
    header: "24h Change",
    align: "end",
    cell: (row) => `${row.priceChangePercent}%`,
    sortAccessor: (row) => row.priceChangePercent,
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "volume",
    header: "24h Volume",
    align: "end",
    cell: (row) => formatUsd(row.tradeVolume),
    sortAccessor: (row) => row.tradeVolume,
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "cap",
    header: "Notional Cap",
    align: "end",
    cell: (row) => formatUsd(row.notionalCap),
    sortAccessor: (row) => row.notionalCap,
    cellClassName: "text-muted-foreground font-mono",
  },
];

/**
 * Solvers-page card for `/get_market_info`. The response diverges by solver:
 * Enigma returns 24h volume + lifetime value per market plus aggregate totals;
 * Rasa returns price / 24h change / volume / notional cap. Fetched on demand via
 * the Refresh button; the per-market table is searchable by symbol.
 */
export function ReadMarketInfoCard() {
  const query = useMarketInfo();

  return (
    <MethodCard
      testId="method-getMarketInfo"
      name="getMarketInfo"
      mutability="view"
      description="Fetch per-market info from the solver — Enigma: 24h volume + lifetime value + totals; Rasa: price, 24h change, volume, notional cap."
      wide
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-market-info"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Refreshing…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      <ResultPanel testId="result-getMarketInfo" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useMarketInfo> }) {
  const [search, setSearch] = useState("");

  if (query.isLoading && query.isFetching) {
    return <TableSkeleton rows={4} columns={3} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see solver market info.</ResultNote>;
  }

  const data = query.data;
  const term = search.trim().toLowerCase();
  const searchInput = (
    <SearchInput
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      placeholder="Search market…"
      containerClassName="flex-1"
      data-testid="market-info-search"
      aria-label="Search markets"
    />
  );
  const matches = (symbol: string) => term.length === 0 || symbol.toLowerCase().includes(term);

  if (data.kind === "rasa") {
    const visible = data.markets.filter((row) => matches(row.symbol));
    return (
      <div className="flex flex-col gap-4" data-testid={`${testId}-data`}>
        {data.markets.length === 0 ? (
          <ResultNote testId={`${testId}-empty`}>The solver returned no market info.</ResultNote>
        ) : (
          <DataTable
            testId={`${testId}-table`}
            columns={RASA_COLUMNS}
            data={visible}
            totalCount={data.markets.length}
            getRowId={(row) => row.symbol}
            initialSort={{ columnId: "volume", direction: "desc" }}
            defaultPageSize={5}
            emptyMessage="No markets match this search."
            toolbar={searchInput}
          />
        )}
      </div>
    );
  }

  const visible = data.markets.filter((row) => matches(row.symbol));
  return (
    <div className="flex flex-col gap-4" data-testid={`${testId}-data`}>
      <div className="flex flex-wrap gap-6">
        <Stat label="Total 24h volume" value={formatUsd(data.totalValue24h)} testId={`${testId}-total-24h`} />
        <Stat
          label="Total lifetime value"
          value={formatUsd(data.totalLifetimeValue)}
          testId={`${testId}-total-lifetime`}
        />
      </div>

      {data.markets.length === 0 ? (
        <ResultNote testId={`${testId}-empty`}>The solver returned no market volume.</ResultNote>
      ) : (
        <DataTable
          testId={`${testId}-table`}
          columns={ENIGMA_COLUMNS}
          data={visible}
          totalCount={data.markets.length}
          getRowId={(row) => row.symbol}
          initialSort={{ columnId: "volume", direction: "desc" }}
          defaultPageSize={5}
          emptyMessage="No markets match this search."
          toolbar={searchInput}
        />
      )}
    </div>
  );
}

/** Format a dollar amount in compact notation with at most 4 decimal places. */
function formatUsd(value: number): string {
  return formatCompactCurrency(value, { maxDecimals: 4 });
}

/** A compact label/value pair for one aggregate total. */
function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground font-mono text-lg" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
