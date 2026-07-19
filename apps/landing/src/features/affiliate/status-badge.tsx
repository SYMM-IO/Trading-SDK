"use client";

import { LiveDot } from "@/components/live-dot";
import { cn } from "@symmio/ui/lib/utils";

/** Visual tone a lifecycle state maps to. */
export type StatusTone = "primary" | "positive" | "muted";

interface Props {
  /** The label to show inside the pill (context supplies its own wording). */
  label: string;
  /** Which semantic tone to paint the pill and its live dot. */
  tone: StatusTone;
  className?: string;
}

/**
 * The lifecycle status pill — a live dot plus a label, toned per state. Kept
 * purely presentational (label and tone are passed in) so the confirming success
 * screen and the standalone status checker can share the visual while wording
 * each state to their own context.
 */
export function StatusBadge({ label, tone, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
        tone === "positive" && "border-positive/30 bg-positive/10 text-positive",
        tone === "primary" && "border-primary/30 bg-primary/10 text-primary",
        tone === "muted" && "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <LiveDot tone={tone === "positive" ? "positive" : "primary"} />
      {label}
    </span>
  );
}
