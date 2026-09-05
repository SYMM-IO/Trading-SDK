"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { useSymbols } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { SolverTargetSelect, useSolverKindActive, useSolverTargetState } from "./solver-target";

/** One symbol row, derived structurally from the hook's return type. */
type SymbolRow = NonNullable<ReturnType<typeof useSymbols>["data"]>[number];

/** Human-readable label for a per-side trading state code. */
const STATE_LABELS: Record<number, string> = {
  0: "Disabled",
  1: "Close only",
  2: "Open only",
  3: "Enabled",
};

/** Short label for a per-side trading-state code. */
function stateLabel(state: number): string {
  return STATE_LABELS[state] ?? String(state);
}

/**
 * Solvers-page card for `/symbols` — the tradable symbol catalogue the solver
 * lists, with id, name/ticker, max leverage, per-side trading state, and
 * validity. The table is searchable by name. **Enigma-only**: the query is gated
 * to the Enigma solver and stays idle on other chains (it 404s on Rasa/Base).
 */
export function ReadSymbolsCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "enigma" });
  const active = useSolverKindActive("enigma");
  const query = useSymbols({ chainId: target.chainId, solverId: target.solverId, query: { enabled: active } });

  return (
    <MethodCard
      testId="method-getSymbols"
      name="getSymbols"
      mutability="view"
      description="Fetch the tradable symbol catalogue from the solver — id, name, max leverage, per-side trading state, and validity. Enigma-only endpoint."
      wide
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="enigma" testId="select-symbols-solver" />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!active || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-symbols"
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

      {active ? null : (
        <ResultNote testId="result-getSymbols-inactive">
          Switch to the Enigma chain (HyperEVM) to call this endpoint.
        </ResultNote>
      )}

      <ResultPanel testId="result-getSymbols" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useSymbols> }) {
  const [search, setSearch] = useState("");

  const rows = query.data;
  const visible = useMemo(() => {
    if (!rows) return [];
    const term = search.trim().toLowerCase();
    if (term.length === 0) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [rows, search]);

  const columns = useMemo<DataTableColumn<SymbolRow>[]>(() => buildColumns(), []);

  if (query.isLoading && query.isFetching) {
    return <TableSkeleton rows={4} columns={6} alignEndFrom={2} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the solver symbol catalogue.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>The solver returned no symbols.</ResultNote>;
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={columns}
      data={visible}
      totalCount={query.data.length}
      getRowId={(row) => String(row.symbolId)}
      initialSort={{ columnId: "symbolId", direction: "asc" }}
      defaultPageSize={5}
      emptyMessage="No symbols match this search."
      toolbar={
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search symbol…"
          containerClassName="flex-1"
          data-testid="symbols-search"
          aria-label="Search symbols"
        />
      }
    />
  );
}

/** Build the symbols table columns. */
function buildColumns(): DataTableColumn<SymbolRow>[] {
  return [
    {
      id: "symbolId",
      header: "ID",
      align: "end",
      cell: (row) => row.symbolId,
      sortAccessor: (row) => row.symbolId,
      cellClassName: "text-muted-foreground font-mono",
    },
    {
      id: "name",
      header: "Symbol",
      cell: (row) => (
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-foreground font-mono">{row.name}</span>
          <span className="text-muted-foreground text-xs">{row.symbol}</span>
        </span>
      ),
      sortAccessor: (row) => row.name,
    },
    {
      id: "maxLeverage",
      header: "Max lev",
      align: "end",
      cell: (row) => `${row.maxLeverage}×`,
      sortAccessor: (row) => row.maxLeverage,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "stateLong",
      header: "Long",
      align: "end",
      cell: (row) => stateLabel(row.stateLong),
      sortAccessor: (row) => row.stateLong,
      cellClassName: "text-muted-foreground",
    },
    {
      id: "stateShort",
      header: "Short",
      align: "end",
      cell: (row) => stateLabel(row.stateShort),
      sortAccessor: (row) => row.stateShort,
      cellClassName: "text-muted-foreground",
    },
    {
      id: "isValid",
      header: "Valid",
      align: "end",
      cell: (row) => (row.isValid ? "Yes" : "No"),
      sortAccessor: (row) => (row.isValid ? 1 : 0),
      cellClassName: "text-muted-foreground font-mono",
    },
  ];
}
