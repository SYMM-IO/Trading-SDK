"use client";

import { cn } from "@theoldvarorg/ui/lib/utils";
import type { MagicSource } from "./magic-types";

interface Props {
  source: MagicSource;
  /** Poll cadence (ms) — shown for `poll` sources. */
  intervalMs?: number;
  /** Whether the source is actively running (drives the pulse). */
  live?: boolean;
}

/** `Xs` for a millisecond cadence. */
function seconds(ms: number): string {
  const value = ms / 1_000;
  return `${value % 1 === 0 ? value : value.toFixed(1)}s`;
}

/** Trailing label for a transport — `socket`, `poll · 3s`, or `poll+socket · 3s`. */
function sourceLabel(source: MagicSource, intervalMs?: number): string {
  if (source === "socket") return "socket";
  const cadence = intervalMs ? seconds(intervalMs) : "off";
  return source === "hybrid" ? `poll+socket · ${cadence}` : `poll · ${cadence}`;
}

/**
 * Compact transport badge for a magic method — `POLL · 3s` (with a live pulse),
 * `SOCKET` (primary-tinted, reserved for live WS feeds), or `POLL+SOCKET · 3s`
 * for a polled source whose cadence a socket accelerates.
 */
export function SourceBadge({ source, intervalMs, live = false }: Props) {
  const tinted = source === "socket" || source === "hybrid";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase",
        tinted ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live ? "bg-primary animate-pulse" : tinted ? "bg-primary/60" : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {sourceLabel(source, intervalMs)}
    </span>
  );
}
