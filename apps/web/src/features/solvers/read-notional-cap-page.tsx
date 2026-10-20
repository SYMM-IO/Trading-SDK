"use client";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { MethodCard } from "@/features/inspector/method-card";
import { useNotionalCapPage } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Input } from "@symmio/ui/components/input";
import { useState } from "react";
import { useSolverKindActive } from "./solver-target";

type CapRow = NonNullable<ReturnType<typeof useNotionalCapPage>["data"]>["symbols"][number];
const columns: DataTableColumn<CapRow>[] = [
  { id: "symbolId", header: "Symbol ID", cell: (row) => row.symbolId },
  { id: "symbol", header: "Ticker", cell: (row) => row.symbol },
  { id: "used", header: "Used ($)", cell: (row) => row.used },
  { id: "openInterest", header: "Open interest ($)", cell: (row) => row.openInterest },
];
/** Inspect a single server page and its page-only totals, independently of the all-markets read. */
export function ReadNotionalCapPage() {
  const active = useSolverKindActive("enigma");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const valid = Number.isInteger(limit) && limit >= 1 && limit <= 100 && Number.isInteger(offset) && offset >= 0;
  const query = useNotionalCapPage({ limit, offset, query: { enabled: active && valid } });
  return (
    <MethodCard
      testId="method-getNotionalCapPage"
      name="getNotionalCapPage"
      mutability="view"
      description="Read one Enigma notional-cap page. Totals cover this page only."
      wide
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Limit (1–100)
          <Input
            aria-label="Notional cap page limit"
            type="number"
            min={1}
            max={100}
            step={1}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          />
        </label>
        <label className="text-sm">
          Offset
          <Input
            aria-label="Notional cap page offset"
            type="number"
            min={0}
            step={1}
            value={offset}
            onChange={(event) => setOffset(Number(event.target.value))}
          />
        </label>
        <Button
          size="sm"
          disabled={!active || !valid || query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-notional-cap-page"
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {!active ? (
        <ResultNote testId="result-getNotionalCapPage-inactive">Select an Enigma deployment to read caps.</ResultNote>
      ) : !valid ? (
        <ResultNote testId="result-getNotionalCapPage-invalid">
          Use an integer limit from 1 to 100 and a non-negative integer offset.
        </ResultNote>
      ) : (
        <PageResult query={query} />
      )}
    </MethodCard>
  );
}
function PageResult({ query }: { query: ReturnType<typeof useNotionalCapPage> }) {
  if (query.isLoading)
    return (
      <ResultNote testId="result-getNotionalCapPage-loading" loading>
        Loading…
      </ResultNote>
    );
  if (query.error)
    return (
      <ResultError testId="result-getNotionalCapPage-error" kind={query.error.kind} message={query.error.message} />
    );
  if (!query.data)
    return <ResultNote testId="result-getNotionalCapPage-idle">Run the read to inspect one page.</ResultNote>;
  const data = query.data;
  return (
    <div data-testid="result-getNotionalCapPage-data" className="space-y-3">
      <DataList>
        <DataRow label="total matching markets" value={String(data.count)} mono />
        <DataRow label="rows on this page" value={String(data.symbols.length)} mono />
        <DataRow label="page totalOpenInterest" value={String(data.totalOpenInterest)} mono />
        <DataRow label="page totalUsed" value={String(data.totalUsed)} mono />
      </DataList>
      <DataTable
        columns={columns}
        data={data.symbols}
        getRowId={(row) => String(row.symbolId)}
        defaultPageSize={10}
        emptyMessage="No markets on this page."
      />
    </div>
  );
}
