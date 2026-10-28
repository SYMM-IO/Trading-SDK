"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import type { SymmioRequestError } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { JsonView } from "@symmio/ui/components/json-view";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState, type ReactNode } from "react";
import { ResultCell } from "./cells";
import type { ReadSpec } from "./read-catalog";

/** What a runner hands the view: the hook's rows and state, read-agnostic. */
export interface RunResult {
  rows: readonly object[] | undefined;
  /** The SDK's `hasMore`, for reads that report it. */
  hasMore?: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: SymmioRequestError | null;
  /** Lines shown above the rows, e.g. a read's aggregates. */
  summary?: ReactNode;
}

/** Server-side paging over the committed request. */
export interface PagingControls {
  pageIndex: number;
  canGoBack: boolean;
  onPrevious: () => void;
  onNext: (lastRow: object | undefined) => void;
  /** The committed `first`, or the SDK default when it was left out. */
  pageSize: number;
}

interface Props {
  read: ReadSpec;
  result: RunResult;
  paging?: PagingControls;
  collateralDecimals: number;
}

function field(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function pageStatus(read: ReadSpec, rowCount: number, hasMore: boolean | undefined, pageSize: number): string {
  if (read.reportsHasMore) return hasMore ? "more available" : "last page";
  return rowCount >= pageSize ? "page is full, there may be more" : "last page";
}

/**
 * The rows of a run: a table of the read's key columns with a per-row inspector
 * holding every field, or the raw rows as JSON, plus the paging bar. Earlier rows
 * stay on screen while the next page loads.
 */
export function ResultView({ read, result, paging, collateralDecimals }: Props) {
  const [view, setView] = useState<"table" | "json">("table");

  const columns = useMemo<DataTableColumn<object>[]>(
    () =>
      read.columns.map((column) => ({
        id: column.key,
        header: column.label ?? column.key,
        align: column.kind === "wei" || column.kind === "collateral" || column.kind === "int" ? "end" : "start",
        cell: (row) => (
          <ResultCell column={column} value={field(row, column.key)} collateralDecimals={collateralDecimals} />
        ),
      })),
    [read.columns, collateralDecimals],
  );

  if (result.error) {
    const { kind, code, message } = result.error;
    return <ResultError testId="subgraph-result-error" kind={code ? `${kind} · ${code}` : kind} message={message} />;
  }
  if (result.isLoading && !result.rows) {
    return <TableSkeleton rows={5} columns={Math.min(read.columns.length, 6)} testId="subgraph-result-loading" />;
  }
  if (!result.rows) {
    return <ResultNote testId="subgraph-result-idle">Set the filters and params, then Run.</ResultNote>;
  }

  const rows = [...result.rows];
  const lastRow = rows.at(-1);
  const canGoForward = read.reportsHasMore ? result.hasMore === true : paging ? rows.length >= paging.pageSize : false;

  return (
    <div className="flex flex-col gap-3" data-testid="subgraph-result">
      {result.summary}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm" data-testid="subgraph-result-count">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
        {result.isFetching ? <Spinner className="size-4" /> : null}
        <div className="ml-auto flex gap-1" role="group" aria-label="Result view">
          {(["table", "json"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="xs"
              variant={view === option ? "secondary" : "ghost"}
              aria-pressed={view === option}
              data-testid={`subgraph-view-${option}`}
              onClick={() => setView(option)}
            >
              {option === "table" ? "Table" : "JSON"}
            </Button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          testId="subgraph-result-table"
          columns={columns}
          data={rows}
          getRowId={(row, index) => String(field(row, read.rowId) ?? index)}
          renderExpanded={(row) => <JsonView data={row} defaultExpandedDepth={1} />}
          pageSizeOptions={[25, 50, 100]}
          defaultPageSize={25}
          emptyMessage="No rows match."
        />
      ) : (
        <JsonView data={rows} defaultExpandedDepth={1} data-testid="subgraph-result-json" />
      )}

      {paging ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="subgraph-paging">
          <span className="text-muted-foreground text-xs" data-testid="subgraph-page-status">
            Request page {paging.pageIndex + 1} · {pageStatus(read, rows.length, result.hasMore, paging.pageSize)}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!paging.canGoBack || result.isFetching}
              onClick={paging.onPrevious}
              data-testid="subgraph-page-previous"
            >
              ← Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canGoForward || result.isFetching}
              onClick={() => paging.onNext(lastRow)}
              data-testid="subgraph-page-next"
            >
              Next page →
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
