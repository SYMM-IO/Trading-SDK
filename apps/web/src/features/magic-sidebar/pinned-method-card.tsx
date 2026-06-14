"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@symm-frontier/ui/components/popover";
import { cn } from "@symm-frontier/ui/lib/utils";
import { useState } from "react";
import { findMagicMethod } from "./magic-catalog";
import { POLL_INTERVALS, useMagicSidebar, type MagicPin } from "./magic-sidebar-store";
import { SourceBadge } from "./source-badge";

/** A single pinned method on the board: a live card with cadence, collapse, and unpin. */
export function PinnedMethodCard({ pin }: { pin: MagicPin }) {
  const { unpin, setPinInterval } = useMagicSidebar();
  const [collapsed, setCollapsed] = useState(false);
  const method = findMagicMethod(pin.methodId);
  if (!method) return null;

  const Panel = method.Panel;

  return (
    <section
      className={cn(
        "bg-card/40 relative overflow-hidden rounded-2xl border transition-colors",
        collapsed ? "border-border/60" : "border-border/70",
      )}
    >
      {collapsed ? null : <span className="bg-primary/70 absolute inset-y-0 left-0 w-0.5" aria-hidden />}

      <header className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${method.label}` : `Collapse ${method.label} (pauses polling)`}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronIcon className={cn("size-4 transition-transform duration-200", !collapsed && "rotate-90")} />
        </button>

        <span className="text-foreground truncate text-sm font-medium">{method.label}</span>
        <SourceBadge source={method.source} intervalMs={pin.intervalMs} live={!collapsed} />

        <div className="ml-auto flex items-center gap-1">
          <IntervalControl value={pin.intervalMs} onChange={(ms) => setPinInterval(method.id, ms)} />
          <button
            type="button"
            onClick={() => unpin(method.id)}
            aria-label={`Unpin ${method.label}`}
            title="Unpin"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:ring-ring/40 inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
          >
            <XIcon />
          </button>
        </div>
      </header>

      {collapsed ? null : (
        <div className="border-border/60 border-t px-4 py-4">
          <Panel intervalMs={pin.intervalMs} enabled initialInput={pin.seed} />
        </div>
      )}
    </section>
  );
}

function IntervalControl({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Poll interval"
          title="Poll interval"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex h-6 items-center rounded-md border border-transparent px-1.5 font-mono text-[11px] transition-colors outline-none focus-visible:ring-2"
        >
          {value / 1_000}s
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-auto p-1">
        <div className="flex flex-col">
          {POLL_INTERVALS.map((ms) => (
            <button
              key={ms}
              type="button"
              onClick={() => onChange(ms)}
              aria-pressed={ms === value}
              className={cn(
                "rounded-md px-3 py-1.5 text-left font-mono text-xs transition-colors",
                ms === value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {ms / 1_000}s
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
