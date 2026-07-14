import * as React from "react";

import { cn } from "../lib/utils";

/**
 * A bordered, rounded table shell. Wraps a native `<table>` in a horizontally
 * scrollable container so wide tables never overflow their card.
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
  ...props
}: React.ComponentProps<"table"> & {
  /** Classes for the outer bordered container (e.g. to drop the border). */
  containerClassName?: string;
}) {
  return (
    <div
      data-slot="table-container"
      className={cn("border-border/70 overflow-hidden rounded-lg border", containerClassName)}
    >
      <div className="overflow-x-auto">
        <table data-slot="table" className={cn("w-full border-collapse text-sm", className)} {...props} />
      </div>
    </div>
  );
}

/** The `<thead>` band. Carries the muted, uppercase header styling for its cells. */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-primary/[0.06] text-muted-foreground text-left text-xs font-medium tracking-wide uppercase",
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
