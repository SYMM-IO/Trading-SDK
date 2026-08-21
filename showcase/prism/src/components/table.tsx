import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface DataTableProps {
  /** Column template. Every track needs a min-content floor so a long ticker
      can't shift the grid — the design system is explicit about this. */
  columns: string;
  head: ReactNode;
  children: ReactNode;
  /** Pin the head row while the body scrolls — for a table inside a height-bounded panel. */
  stickyHead?: boolean;
  className?: string;
}

/** Grid-based table. Bottom-only hairlines, never vertical rules. */
export function DataTable({ columns, head, children, stickyHead = false, className }: DataTableProps) {
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <div className="min-w-max">
        <div
          className={cn(
            "grid items-center gap-3 border-b border-line-subtle px-4 py-2",
            stickyHead ? "sticky top-0 z-10 bg-bg-1" : null,
          )}
          style={{ gridTemplateColumns: columns }}
        >
          {head}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export interface DataRowProps {
  columns: string;
  children: ReactNode;
  onClick?: () => void;
  /** Left edge marker in the row's market-family color. */
  accent?: string;
  className?: string;
}

/** One table row. Hover lifts to `--bg-2`; the family stripe never moves. */
export function DataRow({ columns, children, onClick, accent, className }: DataRowProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "relative grid items-center gap-3 border-b border-line-subtle px-4 py-2.5",
        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        onClick ? "cursor-pointer hover:bg-bg-2" : null,
        className,
      )}
      style={{ gridTemplateColumns: columns }}
    >
      {accent ? (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full"
          style={{ background: accent }}
        />
      ) : null}
      {children}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

/** Empty state. Says what would appear here and how to make it appear. */
export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <p className="font-display text-md font-semibold text-fg-1">{title}</p>
      {body ? <p className="max-w-[46ch] text-sm text-fg-3">{body}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export interface SkeletonProps {
  className?: string;
}

/** Loading placeholder. Pulses at `--bg-3`. */
export function Skeleton({ className }: SkeletonProps) {
  return <span className={cn("prism-pulse block rounded-sm bg-bg-3", className)} />;
}

export interface SkeletonRowsProps {
  columns: string;
  rows?: number;
  cells: number;
}

/** A block of skeleton rows matching a table's column template. */
export function SkeletonRows({ columns, rows = 4, cells }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid items-center gap-3 border-b border-line-subtle px-4 py-3"
          style={{ gridTemplateColumns: columns }}
        >
          {Array.from({ length: cells }).map((__, cellIndex) => (
            <Skeleton key={cellIndex} className="h-3 w-full max-w-[110px]" />
          ))}
        </div>
      ))}
    </>
  );
}
