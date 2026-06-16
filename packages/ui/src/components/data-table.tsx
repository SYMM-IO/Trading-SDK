"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { DEFAULT_PAGE_SIZE_OPTIONS, Pagination } from "./pagination";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "./table";

/** Sort direction for a {@link DataTable} column. */
export type SortDirection = "asc" | "desc";

/** Active sort state: which column, and in which direction. */
export interface DataTableSort {
  columnId: string;
  direction: SortDirection;
}

/** Value a {@link DataTableColumn.sortAccessor} may return; `null`/`undefined` sort last. */
export type SortableValue = string | number | bigint | null | undefined;

/**
 * Definition of a single {@link DataTable} column.
 *
 * @typeParam TRow - Shape of one row of data.
 */
export interface DataTableColumn<TRow> {
  /** Stable identifier — used as the React key, the sort key, and the header `data-*` hook. */
  id: string;
  /** Header content. */
  header: React.ReactNode;
  /** Renders the cell for a given row. */
  cell: (row: TRow) => React.ReactNode;
  /**
   * When provided, the column header becomes a sort toggle. Returns the
   * comparable value for a row (string compares case-insensitively by locale;
   * number/bigint compare numerically; nullish sorts last).
   */
  sortAccessor?: (row: TRow) => SortableValue;
  /** Horizontal alignment. `"end"` right-aligns the header and its cells (numeric columns). */
  align?: "start" | "end";
  /** Extra classes for every body cell in this column. */
  cellClassName?: string;
  /** Extra classes for this column's header cell. */
  headClassName?: string;
  /**
   * Sizing classes applied to BOTH the header cell and every body cell in this
   * column (e.g. `"min-w-36"`). Use this to give a column breathing room: a
   * width set on a single cell would not reliably constrain the whole column.
   */
  widthClassName?: string;
}

/**
 * Props for {@link DataTable}.
 *
 * @typeParam TRow - Shape of one row of data.
 */
export interface DataTableProps<TRow> {
  /** Column definitions, left to right. */
  columns: DataTableColumn<TRow>[];
  /** The (already filtered) rows to display. Sorting and pagination are applied internally. */
  data: TRow[];
  /** Stable React key for a row. Receives the row and its index in the current (sorted, paged) display order. */
  getRowId: (row: TRow, index: number) => string;
  /** Extra attributes (e.g. `data-*` hooks) merged onto each row's `<tr>`. */
  rowAttributes?: (
    row: TRow,
  ) => React.HTMLAttributes<HTMLTableRowElement> & Record<`data-${string}`, string | number | boolean | undefined>;
  /**
   * When provided, each row gains a leading expander control. Clicking it toggles
   * a full-width detail row, spanning every column, rendered directly beneath the
   * row with this function's output. Omit to render a plain table (no expander
   * column, no behavior change).
   */
  renderExpanded?: (row: TRow) => React.ReactNode;
  /** Row ids (per {@link DataTableProps.getRowId}) expanded on first render. Ignored when `renderExpanded` is absent. */
  defaultExpandedRowIds?: readonly string[];
  /** Initial sort. Omit to start in the data's natural order. */
  initialSort?: DataTableSort;
  /** Selectable page sizes. Defaults to `[5, 10, 25, 50, 100]`. */
  pageSizeOptions?: readonly number[];
  /** Initial page size. Defaults to the first `pageSizeOptions` entry. */
  defaultPageSize?: number;
  /** Render every row without a pagination footer. */
  hidePagination?: boolean;
  /** Content rendered above the table — typically a search box and filters. */
  toolbar?: React.ReactNode;
  /** Shown in place of rows when `data` is empty. */
  emptyMessage?: React.ReactNode;
  /** Unfiltered total, forwarded to the pagination "filtered from N" hint. */
  totalCount?: number;
  /** Prefix for `data-testid` hooks (`{testId}`, `{testId}-pagination`, …). */
  testId?: string;
  className?: string;
}

/** Compare two sortable values; nullish sorts last, strings compare by locale. */
function compareValues(a: SortableValue, b: SortableValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "string" || typeof b === "string") {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * A generic, client-side data table. Give it `columns` and `data`; it owns
 * column sorting (click a sortable header) and pagination, and renders a
 * `toolbar` slot above the table for search/filter controls.
 *
 * Filtering stays with the caller: pass the filtered rows as `data` and the
 * pre-filter count as `totalCount` so the footer can show "filtered from N".
 * Render loading / error / not-yet-fetched states before this component — an
 * empty `data` array is treated as "no rows match".
 *
 * @example
 * ```tsx
 * const columns: DataTableColumn<Token>[] = [
 *   { id: "symbol", header: "Symbol", cell: (t) => t.symbol, sortAccessor: (t) => t.symbol },
 *   { id: "balance", header: "Balance", align: "end", cell: (t) => t.balance, sortAccessor: (t) => t.raw },
 * ];
 * <DataTable columns={columns} data={tokens} getRowId={(t) => t.symbol} initialSort={{ columnId: "symbol", direction: "asc" }} />
 * ```
 */
export function DataTable<TRow>({
  columns,
  data,
  getRowId,
  rowAttributes,
  renderExpanded,
  defaultExpandedRowIds,
  initialSort,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultPageSize,
  hidePagination = false,
  toolbar,
  emptyMessage = "No results.",
  totalCount,
  testId,
  className,
}: DataTableProps<TRow>) {
  const [sort, setSort] = React.useState<DataTableSort | undefined>(initialSort);
  const [pageSize, setPageSize] = React.useState<number>(defaultPageSize ?? pageSizeOptions[0] ?? 10);
  const [page, setPage] = React.useState(1);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set(defaultExpandedRowIds));
  const isExpandable = Boolean(renderExpanded);
  /** Total column count including the leading expander, used for full-width spans. */
  const totalColumnCount = columns.length + (isExpandable ? 1 : 0);

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    const column = columns.find((candidate) => candidate.id === sort.columnId);
    const accessor = column?.sortAccessor;
    if (!accessor) return data;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => compareValues(accessor(a), accessor(b)) * factor);
  }, [data, sort, columns]);

  /**
   * Snap back to the first page whenever the result set or page size changes. The
   * token folds in the first/last row ids so a same-length filter swap (which keeps
   * `data.length` constant) still resets, while an identical-content refetch does not.
   */
  const edgeId = (index: number) => {
    const row = data[index];
    return row === undefined ? "" : getRowId(row, index);
  };
  const dataToken = data.length === 0 ? "" : `${edgeId(0)}|${edgeId(data.length - 1)}`;
  const resultSig = `${data.length}|${dataToken}|${sort?.columnId ?? ""}|${sort?.direction ?? ""}|${pageSize}`;
  const [prevSig, setPrevSig] = React.useState(resultSig);
  if (resultSig !== prevSig) {
    setPrevSig(resultSig);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const rows = hidePagination ? sorted : sorted.slice(start, start + pageSize);

  function toggleSort(column: DataTableColumn<TRow>) {
    if (!column.sortAccessor) return;
    setSort((current) =>
      current?.columnId === column.id
        ? { columnId: column.id, direction: current.direction === "asc" ? "desc" : "asc" }
        : { columnId: column.id, direction: "asc" },
    );
  }

  function toggleExpanded(rowId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  return (
    <div data-testid={testId} className={cn("flex flex-col gap-3", className)}>
      {toolbar}

      <Table>
        <TableHeader>
          <TableRow>
            {isExpandable ? (
              <TableHead className="w-9 px-2">
                <span className="sr-only">Expand row</span>
              </TableHead>
            ) : null}
            {columns.map((column) => {
              const isSortable = Boolean(column.sortAccessor);
              const isActive = sort?.columnId === column.id;
              return (
                <TableHead
                  key={column.id}
                  align={column.align}
                  className={cn(column.widthClassName, column.headClassName)}
                  aria-sort={
                    isActive
                      ? sort?.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : isSortable
                        ? "none"
                        : undefined
                  }
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        "group/sort hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors",
                        column.align === "end" && "flex-row-reverse",
                      )}
                      data-testid={testId ? `${testId}-sort-${column.id}` : undefined}
                    >
                      <span>{column.header}</span>
                      <SortIndicator active={isActive} direction={sort?.direction} />
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={totalColumnCount}>{emptyMessage}</TableEmpty>
          ) : (
            rows.map((row, index) => {
              const rowId = getRowId(row, start + index);
              const isExpanded = isExpandable && expandedIds.has(rowId);
              return (
                <React.Fragment key={rowId}>
                  <TableRow {...rowAttributes?.(row)}>
                    {isExpandable ? (
                      <TableCell className="w-9 px-2 align-middle">
                        <ExpanderButton
                          expanded={isExpanded}
                          onToggle={() => toggleExpanded(rowId)}
                          data-testid={testId ? `${testId}-expander-${rowId}` : undefined}
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        className={cn(column.widthClassName, column.cellClassName)}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isExpanded ? (
                    <TableRow
                      data-slot="table-row-expanded"
                      data-testid={testId ? `${testId}-expanded-${rowId}` : undefined}
                    >
                      <TableCell colSpan={totalColumnCount} className="bg-muted/20 p-0">
                        {renderExpanded?.(row)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>

      {!hidePagination && sorted.length > 0 ? (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={sorted.length}
          totalCount={totalCount}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          testId={testId ? `${testId}-pagination` : undefined}
        />
      ) : null}
    </div>
  );
}

/** Leading row affordance: a chevron button that toggles its row's expanded detail panel. */
function ExpanderButton({
  expanded,
  onToggle,
  ...props
}: {
  expanded: boolean;
  onToggle: () => void;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse row" : "Expand row"}
      className="text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
      {...props}
    >
      <ExpanderChevron expanded={expanded} />
    </button>
  );
}

/** Inline chevron that rotates a quarter-turn down when its row is expanded. */
function ExpanderChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-90")}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Header sort affordance: a faint chevron pair until active, then an up/down arrow. */
function SortIndicator({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) {
    return (
      <ChevronsUpDown
        className="size-3.5 opacity-30 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"
        aria-hidden
      />
    );
  }
  return direction === "asc" ? (
    <ChevronUp className="size-3.5 opacity-70" aria-hidden />
  ) : (
    <ChevronDown className="size-3.5 opacity-70" aria-hidden />
  );
}
