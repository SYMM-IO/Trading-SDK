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
 * One detail panel a row can expand into, with the icon toggle that opens it.
 *
 * @typeParam TRow - Shape of one row of data.
 */
export interface DataTableExpansion<TRow> {
  /** Stable identity, unique within the table. Also used in the toggle's test id. */
  id: string;
  /** Accessible name for the toggle — what the panel shows, e.g. "Position details". */
  label: string;
  /** Icon rendered inside the toggle. Sized by the button; keep it around 14px. */
  icon: React.ReactNode;
  /** The panel, rendered full-width beneath the row while this expansion is open. */
  render: (row: TRow) => React.ReactNode;
}

/** Expansion id used for the single-panel {@link DataTableProps.renderExpanded} shorthand. */
const DEFAULT_EXPANSION_ID = "default";

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
   *
   * Shorthand for a single unlabelled {@link DataTableProps.expansions} entry; pass
   * `expansions` instead when a row needs more than one detail panel.
   */
  renderExpanded?: (row: TRow) => React.ReactNode;
  /**
   * Two or more detail panels per row, each with its own icon toggle in the
   * leading expander column — for example one for a row's summary and one for its
   * underlying records.
   *
   * At most one panel is open per row: activating another switches to it, and
   * activating the open one closes it. Takes precedence over
   * {@link DataTableProps.renderExpanded}.
   */
  expansions?: readonly DataTableExpansion<TRow>[];
  /** Row ids (per {@link DataTableProps.getRowId}) expanded on first render, showing their first expansion. Ignored when the table has no expansions. */
  defaultExpandedRowIds?: readonly string[];
  /** Initial sort. Omit to start in the data's natural order. */
  initialSort?: DataTableSort;
  /** Selectable page sizes. Defaults to `[5, 10, 25, 50, 100]`. */
  pageSizeOptions?: readonly number[];
  /** Initial page size. Defaults to the first `pageSizeOptions` entry. */
  defaultPageSize?: number;
  /** Render every row without a pagination footer. */
  hidePagination?: boolean;
  /**
   * Show at most this many rows at once and scroll the rest beneath a sticky
   * header. The cap is measured from the rendered rows, so wrapped cells still
   * fit, and a table with fewer rows is left uncapped. Applies to the rows on
   * screen, so pair it with `hidePagination` (or a page size above the cap) to
   * have something to scroll.
   */
  maxVisibleRows?: number;
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
  expansions,
  defaultExpandedRowIds,
  initialSort,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultPageSize,
  hidePagination = false,
  maxVisibleRows,
  toolbar,
  emptyMessage = "No results.",
  totalCount,
  testId,
  className,
}: DataTableProps<TRow>) {
  const [sort, setSort] = React.useState<DataTableSort | undefined>(initialSort);
  const [pageSize, setPageSize] = React.useState<number>(defaultPageSize ?? pageSizeOptions[0] ?? 10);
  const [page, setPage] = React.useState(1);
  /**
   * `expansions` wins when supplied; otherwise `renderExpanded` becomes a single
   * chevron-toggled panel, so existing callers keep their exact behaviour.
   */
  const resolvedExpansions = React.useMemo<readonly DataTableExpansion<TRow>[]>(() => {
    if (expansions && expansions.length > 0) return expansions;
    if (renderExpanded) {
      return [{ id: DEFAULT_EXPANSION_ID, label: "Row details", icon: null, render: renderExpanded }];
    }
    return [];
  }, [expansions, renderExpanded]);

  const isExpandable = resolvedExpansions.length > 0;
  /** Which panel each row currently shows, by row id. At most one per row. */
  const [openExpansionByRow, setOpenExpansionByRow] = React.useState<Map<string, string>>(() => {
    const initial = new Map<string, string>();
    const firstId = expansions?.[0]?.id ?? DEFAULT_EXPANSION_ID;
    for (const rowId of defaultExpandedRowIds ?? []) initial.set(rowId, firstId);
    return initial;
  });
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

  function toggleExpansion(rowId: string, expansionId: string) {
    setOpenExpansionByRow((current) => {
      const next = new Map(current);
      /** Re-activating the open panel closes the row; any other switches to it. */
      if (next.get(rowId) === expansionId) next.delete(rowId);
      else next.set(rowId, expansionId);
      return next;
    });
  }

  return (
    <div data-testid={testId} className={cn("flex flex-col gap-3", className)}>
      {toolbar}

      <Table maxVisibleRows={maxVisibleRows}>
        <TableHeader sticky={maxVisibleRows !== undefined}>
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
              const openExpansionId = isExpandable ? openExpansionByRow.get(rowId) : undefined;
              const openExpansion = resolvedExpansions.find((candidate) => candidate.id === openExpansionId);
              return (
                <React.Fragment key={rowId}>
                  <TableRow {...rowAttributes?.(row)}>
                    {isExpandable ? (
                      <TableCell className={cn("px-2 align-middle", resolvedExpansions.length > 1 ? "w-16" : "w-9")}>
                        <div className="flex items-center gap-0.5">
                          {resolvedExpansions.map((expansion) => (
                            <ExpanderButton
                              key={expansion.id}
                              expanded={openExpansionId === expansion.id}
                              label={expansion.label}
                              icon={expansion.icon}
                              onToggle={() => toggleExpansion(rowId, expansion.id)}
                              data-testid={
                                testId
                                  ? expansion.id === DEFAULT_EXPANSION_ID
                                    ? `${testId}-expander-${rowId}`
                                    : `${testId}-expander-${expansion.id}-${rowId}`
                                  : undefined
                              }
                            />
                          ))}
                        </div>
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
                  {openExpansion ? (
                    <TableRow
                      data-slot="table-row-expanded"
                      data-testid={
                        testId
                          ? openExpansion.id === DEFAULT_EXPANSION_ID
                            ? `${testId}-expanded-${rowId}`
                            : `${testId}-expanded-${openExpansion.id}-${rowId}`
                          : undefined
                      }
                    >
                      <TableCell colSpan={totalColumnCount} className="bg-muted/20 p-0">
                        {openExpansion.render(row)}
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
  label,
  icon,
  ...props
}: {
  expanded: boolean;
  onToggle: () => void;
  /** Accessible name. Falls back to generic expand/collapse wording for the chevron. */
  label?: string;
  /** Custom glyph; `null`/omitted renders the rotating chevron. */
  icon?: React.ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  const accessibleName = label
    ? `${expanded ? "Hide" : "Show"} ${label.toLowerCase()}`
    : expanded
      ? "Collapse row"
      : "Expand row";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={accessibleName}
      title={label}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
        /** An icon toggle has no rotation to signal state, so it carries an active fill instead. */
        icon && expanded
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      )}
      {...props}
    >
      {icon ?? <ExpanderChevron expanded={expanded} />}
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
