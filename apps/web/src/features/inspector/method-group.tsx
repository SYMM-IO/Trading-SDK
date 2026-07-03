"use client";

import { cn } from "@symmio/ui/lib/utils";
import { useState, type ReactNode } from "react";

interface Props {
  /** Section heading (e.g. "Reads", "Deposits"). */
  label: string;
  /** Number of methods in the group, shown at the end of the heading row. */
  count: number;
  /** Render cards in a single full-width column instead of the two-column grid. */
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Collapsible section grouping a set of {@link MethodCard}s into a two-column
 * grid, with a heading that toggles visibility. Shared by the Inspector shells.
 * Pass {@link Props.fullWidth} to lay the cards out in one full-width column.
 */
export function MethodGroup({ label, count, fullWidth = false, children }: Props) {
  const [open, setOpen] = useState(true);
  const contentId = `methods-${label.toLowerCase().replace(/\s+/g, "-")}`;

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
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className={cn("grid grid-cols-1 items-stretch gap-4 pt-4", !fullWidth && "lg:grid-cols-2")}>
            {children}
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
