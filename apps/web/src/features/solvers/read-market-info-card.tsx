"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { useMarketInfo } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatCompactCurrency } from "@symmio/utils";
import { useMemo, useState } from "react";

/** One market's volume row, derived structurally from the hook's return type. */
type MarketVolumeRow = NonNullable<ReturnType<typeof useMarketInfo>["data"]>["markets"][number];

const COLUMNS: DataTableColumn<MarketVolumeRow>[] = [
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

/**
 * Solvers-page card for `/get_market_info` — the rolling 24-hour trading volume
 * and cumulative lifetime value for every market the solver lists, plus the
 * aggregate totals. Fetched on demand via the Refresh button (no auto-polling);
 * the per-market table is searchable by symbol.
 */
export function ReadMarketInfoCard() {
  const query = useMarketInfo();

  return (
    <MethodCard
      testId="method-getMarketInfo"
      name="getMarketInfo"
      mutability="view"
      description="Fetch per-market 24h trading volume and lifetime value from the solver, plus the aggregate totals across every market."
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

  const markets = query.data?.markets;
  const visible = useMemo(() => {
    if (!markets) return [];
    const term = search.trim().toLowerCase();
    if (term.length === 0) return markets;
    return markets.filter((row) => row.symbol.toLowerCase().includes(term));
  }, [markets, search]);

  if (query.isLoading && query.isFetching) {
    return <TableSkeleton rows={4} columns={3} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see solver market volume.</ResultNote>;
  }
  const { markets: allMarkets, totalValue24h, totalLifetimeValue } = query.data;

  return (
    <div className="flex flex-col gap-4" data-testid={`${testId}-data`}>
      <div className="flex flex-wrap gap-6">
        <Stat label="Total 24h volume" value={formatUsd(totalValue24h)} testId={`${testId}-total-24h`} />
        <Stat label="Total lifetime value" value={formatUsd(totalLifetimeValue)} testId={`${testId}-total-lifetime`} />
      </div>

      {allMarkets.length === 0 ? (
        <ResultNote testId={`${testId}-empty`}>The solver returned no market volume.</ResultNote>
      ) : (
        <DataTable
          testId={`${testId}-table`}
          columns={COLUMNS}
          data={visible}
          totalCount={allMarkets.length}
          getRowId={(row) => row.symbol}
          initialSort={{ columnId: "volume", direction: "desc" }}
          defaultPageSize={5}
          emptyMessage="No markets match this search."
          toolbar={
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search market…"
              containerClassName="flex-1"
              data-testid="market-info-search"
              aria-label="Search markets"
            />
          }
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
