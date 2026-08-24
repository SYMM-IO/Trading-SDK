"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { useRevenueRecords } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo } from "react";
import { SolverTargetSelect, useSolverKindActive, useSolverTargetState } from "./solver-target";

/** One revenue record row, derived structurally from the hook's return type. */
type RevenueRow = NonNullable<ReturnType<typeof useRevenueRecords>["data"]>["records"][number];

/**
 * Solvers-page card for `/revenue/records` — the incremental revenue records the
 * solver has produced (id, symbol id, amount, and creation timestamp). Records
 * are cursor-paginated on the id; the card shows the current page against the
 * total available count. **Enigma-only**: the query is gated to the Enigma
 * solver and stays idle on other chains (it 404s on Rasa/Base).
 */
export function ReadRevenueRecordsCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "enigma" });
  const active = useSolverKindActive("enigma");
  const query = useRevenueRecords({ chainId: target.chainId, solverId: target.solverId, query: { enabled: active } });

  return (
    <MethodCard
      testId="method-getRevenueRecords"
      name="getRevenueRecords"
      mutability="view"
      description="Fetch incremental revenue records (amount per symbol, with creation time) from the solver. Enigma-only endpoint."
      wide
    >
      <SolverTargetSelect
        value={target}
        onChange={setTarget}
        requireKind="enigma"
        testId="select-revenue-records-solver"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!active || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-revenue-records"
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
        <ResultNote testId="result-getRevenueRecords-inactive">
          Switch to the Enigma chain (HyperEVM) to call this endpoint.
        </ResultNote>
      )}

      <ResultPanel testId="result-getRevenueRecords" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useRevenueRecords> }) {
  const columns = useMemo<DataTableColumn<RevenueRow>[]>(() => buildColumns(), []);

  if (query.isLoading && query.isFetching) {
    return <TableSkeleton rows={4} columns={4} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see solver revenue records.</ResultNote>;
  }
  if (query.data.records.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>The solver returned no revenue records.</ResultNote>;
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={columns}
      data={query.data.records}
      totalCount={query.data.count}
      getRowId={(row) => String(row.id)}
      initialSort={{ columnId: "id", direction: "desc" }}
      defaultPageSize={5}
      emptyMessage="No revenue records."
    />
  );
}

/** Build the table columns for the revenue records. */
function buildColumns(): DataTableColumn<RevenueRow>[] {
  return [
    {
      id: "id",
      header: "ID",
      cell: (row) => row.id,
      sortAccessor: (row) => row.id,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "symbolId",
      header: "Symbol ID",
      align: "end",
      cell: (row) => row.symbolId,
      sortAccessor: (row) => row.symbolId,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      cell: (row) => row.amount,
      sortAccessor: (row) => row.amount,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "createdAt",
      header: "Created at",
      align: "end",
      cell: (row) => row.createdAt,
      sortAccessor: (row) => row.createdAt,
      cellClassName: "text-muted-foreground font-mono",
    },
  ];
}
