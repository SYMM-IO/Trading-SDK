"use client";

import { cn } from "@symmio/ui/lib/utils";
import { useState, type ReactNode } from "react";

/** How many card columns the group lays out once it is wide enough for them. */
type Columns = 1 | 2 | 4;

interface Props {
  /** Section heading (e.g. "Reads", "Deposits"). */
  label: string;
  /** Number of methods in the group, shown at the end of the heading row. */
  count: number;
  /** Render cards in a single full-width column instead of the two-column grid. */
  fullWidth?: boolean;
  /**
   * Column count at full width. `2` (default) is the usual method grid; `4` is
   * a headline-figure strip that folds to two, then one, as the group narrows.
   * `fullWidth` is shorthand for `1`.
   */
  columns?: Columns;
  /** Optional content rendered above the grid, inside the collapsible region — e.g. a shared input bar. */
  lead?: ReactNode;
  children: ReactNode;
}

/**
 * Column classes per layout, keyed on the group's own width rather than the
 * viewport: the page can be far narrower than the window with the magic
 * sidebar docked, and the grid must fold with the page.
 */
const GRID_COLUMNS: Record<Columns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @4xl:grid-cols-2",
  4: "grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-4",
};

/**
 * Collapsible section grouping a set of {@link MethodCard}s into a grid, with
 * a heading that toggles visibility. Shared by the Inspector shells.
 *
 * The group measures itself — the grid folds on the group's width, not the
 * viewport — and a card that needs the whole row spans every column it has,
 * so a `wide` card stays correct at any column count.
 */
export function MethodGroup({ label, count, fullWidth = false, columns, lead, children }: Props) {
  const [open, setOpen] = useState(true);
  const contentId = `methods-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const layout: Columns = columns ?? (fullWidth ? 1 : 2);

  return (
    <div className="animate-enter-up flex flex-col">
      <h2 className="text-xs font-medium tracking-[0.18em] uppercase">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 group/sec flex w-full items-center gap-3 rounded-md py-1 transition-colors outline-none focus-visible:ring-2 motion-reduce:transition-none"
        >
          <ChevronIcon
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-300 motion-reduce:transition-none",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
          {label}
          <span className="bg-border/80 h-px flex-1" aria-hidden />
          <span className="font-mono text-xs tracking-normal normal-case">{count}</span>
        </button>
      </h2>

      <div
        id={contentId}
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="@container min-h-0 overflow-hidden" inert={!open}>
          <div className="flex flex-col gap-4 pt-4">
            {lead}
            <div className={cn("grid items-stretch gap-4", GRID_COLUMNS[layout])}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
