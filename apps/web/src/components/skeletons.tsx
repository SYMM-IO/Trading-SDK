import { Skeleton } from "@symm-frontier/ui/components/skeleton";
import { cn } from "@symm-frontier/ui/lib/utils";
import type { CSSProperties } from "react";

const CELL_WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5"];

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  /** Columns at this index and beyond render right-aligned, matching trailing numeric columns. */
  alignEndFrom?: number;
  testId?: string;
}

/** Loading placeholder shaped like a bordered data table — header band plus pulsing rows. */
export function TableSkeleton({ rows = 5, columns = 4, alignEndFrom = Infinity, testId }: TableSkeletonProps) {
  const gridCols: CSSProperties = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  const cols = Array.from({ length: columns }, (_, i) => ({
    key: `c${i}`,
    w: CELL_WIDTHS[i % CELL_WIDTHS.length],
    end: i >= alignEndFrom,
  }));
  const rowList = Array.from({ length: rows }, (_, i) => `r${i}`);

  return (
    <div
      data-testid={testId}
      aria-busy="true"
      aria-label="Loading results"
      className="border-border/70 overflow-hidden rounded-xl border"
    >
      <div className="bg-muted/40 grid gap-3 px-3 py-2.5" style={gridCols}>
        {cols.map((col) => (
          <Skeleton key={col.key} className={cn("h-3 w-14", col.end && "justify-self-end")} />
        ))}
      </div>
      {rowList.map((rowKey) => (
        <div key={rowKey} className="border-border/60 grid items-center gap-3 border-t px-3 py-2.5" style={gridCols}>
          {cols.map((col) => (
            <Skeleton key={col.key} className={cn("h-4", col.end ? "w-12 justify-self-end" : col.w)} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder for a vertical list of address pills. */
export function ListSkeleton({ rows = 3, testId }: { rows?: number; testId?: string }) {
  const rowList = Array.from({ length: rows }, (_, i) => `r${i}`);
  return (
    <ul data-testid={testId} aria-busy="true" aria-label="Loading results" className="flex flex-col gap-1.5">
      {rowList.map((rowKey) => (
        <li key={rowKey} className="border-border/60 bg-muted/30 flex items-center rounded-lg border px-3 py-2">
          <Skeleton className="h-4 w-72 max-w-full" />
        </li>
      ))}
    </ul>
  );
}

/** Loading placeholder for a label/value definition list. */
export function DataRowsSkeleton({ rows = 6, testId }: { rows?: number; testId?: string }) {
  const rowList = Array.from({ length: rows }, (_, i) => ({ key: `r${i}`, w: CELL_WIDTHS[i % CELL_WIDTHS.length] }));
  return (
    <dl data-testid={testId} aria-busy="true" aria-label="Loading results" className="divide-border/60 divide-y">
      {rowList.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-4 py-2.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className={cn("h-4", row.w)} />
        </div>
      ))}
    </dl>
  );
}
