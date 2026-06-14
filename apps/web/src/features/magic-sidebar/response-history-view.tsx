"use client";

import { JsonView } from "@symm-frontier/ui/components/json-view";
import { cn } from "@symm-frontier/ui/lib/utils";
import type { PollHistoryEntry } from "./use-poll-history";

interface Props {
  /** Newest-first history; index 0 is the current response. */
  entries: PollHistoryEntry<unknown>[];
  /** Whether a poll request is in flight (drives the live pulse). */
  isFetching: boolean;
  /** Note shown before the first response arrives. */
  emptyLabel?: string;
}

/** `HH:MM:SS` for a millisecond epoch. */
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour12: false });
}

/**
 * Live response viewer for a polled method: the latest response highlighted at
 * the top, with every superseded response kept below as a dimmed, timestamped
 * "stale" entry. The newest change is always front and center; the history shows
 * how the response evolved over the session.
 */
export function ResponseHistoryView({ entries, isFetching, emptyLabel = "Waiting for the first response…" }: Props) {
  if (entries.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm">
        {isFetching ? <PulseDot /> : null}
        <span>{isFetching ? "Polling…" : emptyLabel}</span>
      </div>
    );
  }

  const [current, ...past] = entries;
  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <header className="flex items-center justify-between gap-2">
          <span className="text-foreground flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
            <PulseDot active={isFetching} />
            Latest
          </span>
          <time className="text-muted-foreground font-mono text-[11px]">{formatTime(current.at)}</time>
        </header>
        <div className="ring-primary/25 overflow-hidden rounded-xl ring-1">
          <JsonView data={current.data} defaultExpandedDepth={2} />
        </div>
      </section>

      {past.length > 0 ? (
        <section className="flex flex-col gap-2">
          <header className="flex items-center gap-3">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
              History · {past.length}
            </span>
            <span className="bg-border/60 h-px flex-1" aria-hidden />
          </header>
          <div className="flex flex-col gap-2">
            {past.map((entry, index) => (
              <StaleEntry key={entry.id} entry={entry} stepsBack={index + 1} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StaleEntry({ entry, stepsBack }: { entry: PollHistoryEntry<unknown>; stepsBack: number }) {
  return (
    <div className="opacity-65 transition-opacity hover:opacity-100">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-muted-foreground/80 inline-flex items-center gap-1.5 text-[11px]">
          <span className="border-border/70 text-muted-foreground/80 rounded border px-1.5 py-px font-mono text-[10px] tracking-wide uppercase">
            stale
          </span>
          <span className="text-muted-foreground/60">−{stepsBack}</span>
        </span>
        <time className="text-muted-foreground/70 font-mono text-[11px]">{formatTime(entry.at)}</time>
      </div>
      <JsonView data={entry.data} defaultExpandedDepth={0} className="bg-muted/10" />
    </div>
  );
}

function PulseDot({ active = true }: { active?: boolean }) {
  return (
    <span className="relative inline-flex size-2 shrink-0" aria-hidden>
      {active ? <span className="bg-primary/60 absolute inline-flex size-full animate-ping rounded-full" /> : null}
      <span
        className={cn("relative inline-flex size-2 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")}
      />
    </span>
  );
}
