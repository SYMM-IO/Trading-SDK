"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { useEnigmaPriceServiceSymbolsInfo } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";

type SymbolRow = NonNullable<ReturnType<typeof useEnigmaPriceServiceSymbolsInfo>["data"]>[number];

const COLUMNS: DataTableColumn<SymbolRow>[] = [
  {
    id: "name",
    header: "Name",
    cell: (symbol) => symbol.name,
    sortAccessor: (symbol) => symbol.name,
    cellClassName: "font-mono",
  },
  {
    id: "status",
    header: "Status",
    cell: (symbol) => (
      <Badge variant={String(symbol.status) === "TRADING" ? "positive" : "secondary"}>{symbol.status}</Badge>
    ),
    sortAccessor: (symbol) => String(symbol.status),
  },
  {
    id: "address",
    header: "Address",
    cell: (symbol) => (
      <span className="flex items-center gap-1.5">
        <span className="max-w-96 truncate" title={symbol.address}>
          {symbol.address}
        </span>
        <CopyButton value={symbol.address} label="Copy address" className="size-5 shrink-0" />
      </span>
    ),
    sortAccessor: (symbol) => symbol.address,
    cellClassName: "text-muted-foreground font-mono",
  },
];

export function ReadEnigmaPriceServiceSymbolsInfo() {
  const query = useEnigmaPriceServiceSymbolsInfo({ query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getEnigmaPriceServiceSymbolsInfo"
      name="getEnigmaPriceServiceSymbolsInfo"
      mutability="view"
      description="Fetch known symbols, statuses, and token addresses from the Enigma price service."
      wide
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-enigma-price-service-symbols-info"
        >
          {query.isFetching ? (
            <>
              <Spinner className="size-4" /> Reading...
            </>
          ) : (
            "Read symbols info"
          )}
        </Button>
        {query.data ? (
          <span className="text-muted-foreground font-mono text-xs">
            {query.data.length} symbol{query.data.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <ResultPanel testId="result-getEnigmaPriceServiceSymbolsInfo" query={query} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
}: {
  testId: string;
  query: ReturnType<typeof useEnigmaPriceServiceSymbolsInfo>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const visible = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLowerCase();
    return query.data.filter((symbol) => {
      const matchesTerm =
        term.length === 0 || symbol.name.toLowerCase().includes(term) || symbol.address.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || String(symbol.status) === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [query.data, search, statusFilter]);

  if (query.isFetching) {
    return <TableSkeleton rows={6} columns={3} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Click the button to read symbols info.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No symbols returned.</ResultNote>;
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={COLUMNS}
      data={visible}
      totalCount={query.data.length}
      getRowId={(symbol) => `${symbol.address}-${symbol.name}`}
      initialSort={{ columnId: "name", direction: "asc" }}
      defaultPageSize={6}
      emptyMessage="No symbols match these filters."
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or address…"
            containerClassName="flex-1"
            data-testid="symbols-search"
            aria-label="Search symbols"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-40" data-testid="symbols-status-filter" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="TRADING">Trading</SelectItem>
              <SelectItem value="SETTLING">Settling</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}
