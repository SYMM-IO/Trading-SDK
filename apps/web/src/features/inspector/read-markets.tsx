"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { useMarkets } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { DataTable, type DataTableColumn } from "@symm-frontier/ui/components/data-table";
import { SearchInput } from "@symm-frontier/ui/components/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symm-frontier/ui/components/select";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "./method-card";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

const COLUMNS: DataTableColumn<Market>[] = [
  {
    id: "symbol_id",
    header: "ID",
    cell: (market) => market.symbol_id,
    sortAccessor: (market) => market.symbol_id ?? 0,
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "symbol",
    header: "Symbol",
    cell: (market) => market.symbol,
    sortAccessor: (market) => market.symbol ?? "",
    cellClassName: "text-foreground font-mono font-medium",
  },
  {
    id: "name",
    header: "Name",
    cell: (market) => market.name,
    sortAccessor: (market) => market.name ?? "",
    cellClassName: "text-foreground",
  },
  {
    id: "state",
    header: "State",
    cell: (market) => <MarketStateBadge state={market.state} />,
    sortAccessor: (market) => market.state ?? -1,
  },
  {
    id: "max_leverage",
    header: "Max leverage",
    align: "end",
    cell: (market) => `${market.max_leverage}×`,
    sortAccessor: (market) => Number(market.max_leverage ?? 0),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "trading_fee",
    header: "Trading fee",
    align: "end",
    cell: (market) => market.trading_fee,
    sortAccessor: (market) => Number(market.trading_fee ?? 0),
    cellClassName: "text-muted-foreground font-mono",
  },
];

export function ReadMarkets() {
  const query = useMarkets();

  return (
    <MethodCard
      testId="method-getMarkets"
      name="getMarkets"
      magicMethodId="markets"
      mutability="view"
      description="Fetch all tradable markets (contract symbols) from the solver."
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-markets"
        >
          {query.isFetching ? <Spinner className="size-4" /> : <RefreshIcon />}
          {query.isFetching ? "Fetching…" : query.data ? "Refresh" : "Fetch markets"}
        </Button>
        {query.data ? (
          <span className="text-muted-foreground font-mono text-xs">
            {query.data.length} market{query.data.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <ResultPanel testId="result-getMarkets" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useMarkets> }) {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");

  const visible = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLowerCase();
    return query.data.filter((market) => {
      const matchesTerm =
        term.length === 0 ||
        market.symbol?.toLowerCase().includes(term) ||
        market.name?.toLowerCase().includes(term) ||
        String(market.symbol_id).includes(term);
      const matchesState = stateFilter === "all" || market.state === Number(stateFilter);
      return matchesTerm && matchesState;
    });
  }, [query.data, search, stateFilter]);

  if (query.isLoading) {
    return <TableSkeleton rows={6} columns={6} alignEndFrom={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Click the button to fetch markets.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No markets found.</ResultNote>;
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={COLUMNS}
      data={visible}
      totalCount={query.data.length}
      getRowId={(market) => String(market.symbol_id)}
      rowAttributes={(market) => ({ "data-market-id": market.symbol_id })}
      initialSort={{ columnId: "symbol_id", direction: "asc" }}
      defaultPageSize={5}
      emptyMessage="No markets match these filters."
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search symbol, name, or ID…"
            containerClassName="flex-1"
            data-testid="markets-search"
            aria-label="Search markets"
          />

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="sm:w-40" data-testid="markets-state-filter" aria-label="Filter by state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="3">Enabled</SelectItem>
              <SelectItem value="2">Open only</SelectItem>
              <SelectItem value="1">Close only</SelectItem>
              <SelectItem value="0">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}

function MarketStateBadge({ state }: { state: Market["state"] }) {
  const map: Record<number, { label: string; variant: "positive" | "secondary" | "destructive" | "warning" }> = {
    0: { label: "Disabled", variant: "destructive" },
    1: { label: "Close only", variant: "warning" },
    2: { label: "Open only", variant: "secondary" },
    3: { label: "Enabled", variant: "positive" },
  };
  const entry = map[state ?? -1];
  if (!entry) return <Badge variant="outline">Unknown ({state})</Badge>;
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
