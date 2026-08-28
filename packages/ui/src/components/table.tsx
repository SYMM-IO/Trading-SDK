"use client";

import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Cap the scroll viewport so exactly `maxVisibleRows` body rows fit: the header
 * plus the rendered height of the first N rows. With fewer rows the cap is
 * lifted, so a short table never reserves empty space.
 */
function capViewportToRows(viewport: HTMLDivElement, table: HTMLTableElement, maxVisibleRows: number) {
  const lastVisible = table.tBodies[0]?.rows[maxVisibleRows - 1];
  /** A row's `offsetTop` is measured from the table, so it already spans the header. */
  viewport.style.maxHeight = lastVisible ? `${lastVisible.offsetTop + lastVisible.offsetHeight}px` : "";
}

/**
 * A bordered, rounded table shell. Wraps a native `<table>` in a horizontally
 * scrollable container so wide tables never overflow their card.
 *
 * Pass `maxVisibleRows` to also cap the height: only that many body rows show
 * at once and the rest scroll beneath the header. The cap is measured from the
 * rendered rows (so wrapped cells still fit) and re-measured on resize. Pair it
 * with `<TableHeader sticky>` so the header stays put while the rows scroll.
 *
 * Compose with {@link TableHeader}, {@link TableBody}, {@link TableRow},
 * {@link TableHead}, and {@link TableCell}. For a data-driven table with
 * built-in sorting and pagination, prefer the higher-level `DataTable`.
 *
 * @example
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Name</TableHead>
 *       <TableHead align="end">Amount</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>USDC</TableCell>
 *       <TableCell align="end">1,000</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 */
function Table({
  className,
  containerClassName,
  maxVisibleRows,
  ...props
}: Omit<React.ComponentProps<"table">, "ref"> & {
  /** Classes for the outer bordered container (e.g. to drop the border). */
  containerClassName?: string;
  /**
   * Show at most this many body rows and scroll the rest. Counts `<tbody>` rows
   * as rendered, so an expanded detail row takes one slot. Omit for no cap.
   */
  maxVisibleRows?: number;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const isCapped = maxVisibleRows !== undefined;

  /** Re-measure after every commit: rows come and go with the data. */
  React.useLayoutEffect(() => {
    if (viewportRef.current && tableRef.current && maxVisibleRows !== undefined) {
      capViewportToRows(viewportRef.current, tableRef.current, maxVisibleRows);
    }
  });

  /** Re-measure on resize: a narrower column wraps its cells and every row grows. */
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const table = tableRef.current;
    if (!viewport || !table) return;
    if (maxVisibleRows === undefined) {
      viewport.style.maxHeight = "";
      return;
    }
    const observer = new ResizeObserver(() => capViewportToRows(viewport, table, maxVisibleRows));
    observer.observe(table);
    return () => observer.disconnect();
  }, [maxVisibleRows]);

  return (
    <div
      data-slot="table-container"
      className={cn("border-border/70 overflow-hidden rounded-lg border", containerClassName)}
    >
      <div ref={viewportRef} className={cn("overflow-x-auto", isCapped && "overflow-y-auto")}>
        <table
          ref={tableRef}
          data-slot="table"
          className={cn("w-full border-collapse text-sm", className)}
          {...props}
        />
      </div>
    </div>
  );
}

/**
 * The `<thead>` band. Carries the muted, uppercase header styling for its cells.
 *
 * Set `sticky` when the table scrolls vertically (see `Table`'s
 * `maxVisibleRows`): the header pins to the top of the viewport over an opaque
 * card surface so the rows scroll beneath it instead of through it.
 */
function TableHeader({ className, sticky = false, ...props }: React.ComponentProps<"thead"> & { sticky?: boolean }) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "text-muted-foreground text-left text-xs font-medium tracking-wide uppercase",
        /** The usual tint is translucent; sticky needs a solid base under it so scrolled rows do not bleed through. */
        sticky ? "bg-card [&>tr]:bg-primary/[0.06] sticky top-0 z-10" : "bg-primary/[0.06]",
        className,
      )}
      {...props}
    />
  );
}

/** The `<tbody>`. Applies the row divider + hover styling to every row it contains. */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr]:border-border/60 [&_tr:hover]:bg-muted/30 [&_tr]:border-t [&_tr]:transition-colors",
        className,
      )}
      {...props}
    />
  );
}

/** A table row. Body rows inherit divider + hover styling from {@link TableBody}. */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn(className)} {...props} />;
}

/** A header cell. Pass `align="end"` to right-align (numeric columns). */
function TableHead({
  className,
  align = "start",
  ...props
}: Omit<React.ComponentProps<"th">, "align"> & { align?: "start" | "end" }) {
  return (
    <th
      data-slot="table-head"
      className={cn("px-3 py-2.5 whitespace-nowrap", align === "end" && "text-right", className)}
      {...props}
    />
  );
}

/** A body cell. Pass `align="end"` to right-align (numeric columns). */
function TableCell({
  className,
  align = "start",
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & { align?: "start" | "end" }) {
  return (
    <td data-slot="table-cell" className={cn("px-3 py-2.5", align === "end" && "text-right", className)} {...props} />
  );
}

/** A full-width placeholder row for the "no rows match" state. Keeps the header visible. */
function TableEmpty({ className, colSpan, children, ...props }: React.ComponentProps<"td"> & { colSpan?: number }) {
  return (
    <tr data-slot="table-empty">
      <td
        colSpan={colSpan}
        role="status"
        className={cn("text-muted-foreground px-3 py-8 text-center text-sm", className)}
        {...props}
      >
        {children}
      </td>
    </tr>
  );
}

export { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow };
