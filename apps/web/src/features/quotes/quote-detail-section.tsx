"use client";
import { cn } from "@symmio/ui/lib/utils";
import { useState, type ReactNode } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0 transition-transform", open && "rotate-90")}
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** One label/value pair inside a {@link QuoteDetailSection}. */
export function DetailRow({
  label,
  value,
  title,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  title?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground shrink-0 text-[0.7rem]">{label}</span>
      <span className={cn("text-foreground truncate font-mono text-xs", valueClassName)} title={title}>
        {value}
      </span>
    </div>
  );
}

interface Props {
  title: string;
  /**
   * The section's own headline answer, shown beside the title while it is closed.
   * A folded section still has to be worth folding — if closing it hides the
   * question as well as the answer, the reader has to open every one to find
   * anything.
   */
  summary?: ReactNode;
  /** Fold this section behind its title. Sections are never folded where there is width to show them. */
  collapsible?: boolean;
  /** Start open. Ignored when the section is not collapsible. */
  defaultOpen?: boolean;
  /** Notified whenever the section folds or unfolds — the hook a lazily-loaded body needs. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Let this section's label/value rows run two across once there is room.
   *
   * Only for a section that spans the panel's full width. A section that is
   * already one column of a multi-column grid has no width to split, and the
   * container query behind this measures the panel, not the section.
   */
  rowColumns?: boolean;
  children: ReactNode;
}

/**
 * One titled group of detail rows.
 *
 * Collapsible is a property of the *panel*, not of the width: the drill-in folds
 * its sections because height is the scarce axis in a capped card body, while the
 * table's in-place panel has room to show every section at once and folding there
 * would only add clicks.
 */
export function QuoteDetailSection({
  title,
  summary,
  collapsible = false,
  defaultOpen = false,
  onOpenChange,
  rowColumns = false,
  children,
}: Props) {
  const body = cn(
    "flex flex-col gap-1.5",
    rowColumns && "@2xl/quotes:grid @2xl/quotes:grid-cols-2 @2xl/quotes:gap-x-8",
  );
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  }

  if (!collapsible) {
    return (
      <section className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h4 className="text-foreground/90 shrink-0 text-[0.7rem] font-semibold">{title}</h4>
          <span className="bg-border/70 h-px flex-1" aria-hidden />
          {summary ? <span className="text-muted-foreground shrink-0 font-mono text-[0.7rem]">{summary}</span> : null}
        </div>
        <div className={body}>{children}</div>
      </section>
    );
  }

  return (
    <section className="border-border/70 bg-muted/30 min-w-0 rounded-lg border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-3 py-2.5 transition-colors"
      >
        <ChevronIcon open={open} />
        <h4 className="text-foreground/90 shrink-0 text-[0.7rem] font-semibold">{title}</h4>
        <span className="flex-1" />
        {summary ? <span className="truncate font-mono text-[0.7rem]">{summary}</span> : null}
      </button>
      {open ? <div className={cn(body, "px-3 pb-3")}>{children}</div> : null}
    </section>
  );
}
