"use client";

import { cn } from "@/lib/cn";
import { useState, type ReactNode } from "react";
import { Skeleton } from "./table";
import { InfoTip } from "./tooltip";

export interface DetailSectionProps {
  /** Section name, set as a micro-label with a rule running out to the edge. */
  title: string;
  /** Right-aligned note on the rule — a scope caveat, a count, a source. */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A titled block of label → value rows.
 *
 * The rule that runs out from the title is doing structural work: this list is
 * long enough that a reader scanning for one figure needs landmarks, and the
 * design system forbids boxing each group in its own card — nested cards inside
 * a sheet that is itself a card read as three levels of hierarchy where there
 * are only two.
 */
export function DetailSection({ title, note, children, className }: DetailSectionProps) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="text-2xs font-semibold tracking-[0.12em] whitespace-nowrap text-fg-3 uppercase">{title}</span>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-line-subtle" />
        {note ? <span className="text-2xs whitespace-nowrap text-fg-3">{note}</span> : null}
      </div>
      <dl className="flex flex-col">{children}</dl>
    </section>
  );
}

export interface DetailRowProps {
  label: ReactNode;
  /** Definition shown behind an information dot on the label. */
  tip?: { title: string; body: ReactNode };
  /** The figure. Wrap numbers in `<Numeric>` — the system's tabular rule. */
  value: ReactNode;
  /** Caption under the value — a unit, a mode, a qualifier. */
  sub?: ReactNode;
  /** A control that belongs to this row, e.g. copy or edit. */
  action?: ReactNode;
  isLoading?: boolean;
  className?: string;
}

/**
 * One label → value line.
 *
 * A definition-list pair rather than two divs, because that is what it is: half
 * these rows are terms a trader may not know, and the tip that defines them
 * hangs off the term.
 */
export function DetailRow({ label, tip, value, sub, action, isLoading = false, className }: DetailRowProps) {
  return (
    <div className={cn("flex min-h-[26px] items-center justify-between gap-4 py-0.5", className)}>
      <dt className="flex min-w-0 items-center gap-1 text-sm text-fg-2">
        <span className="truncate">{label}</span>
        {tip ? (
          <span className="shrink-0 text-fg-3">
            <InfoTip title={tip.title}>{tip.body}</InfoTip>
          </span>
        ) : null}
      </dt>

      <dd className="flex min-w-0 items-center gap-1.5">
        {isLoading ? (
          <Skeleton className="h-3 w-16" />
        ) : (
          <span className="flex min-w-0 flex-col items-end">
            <span className="truncate">{value}</span>
            {sub ? <span className="truncate text-2xs text-fg-3">{sub}</span> : null}
          </span>
        )}
        {action}
      </dd>
    </div>
  );
}

export interface RowActionProps {
  onClick: () => void;
  /** Native tooltip for the icon-only control — it has no label of its own. */
  title: string;
  children: ReactNode;
}

/** The small square control that sits at the end of a detail row. */
export function RowAction({ onClick, title, children }: RowActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line bg-bg-2 text-fg-2",
        "transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:bg-bg-3 hover:text-fg-0",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}

export interface CopyActionProps {
  /** The exact text put on the clipboard — never the truncated display form. */
  value: string;
  /** What is being copied, for the control's label. */
  label: string;
}

/**
 * Copy a row's value.
 *
 * Confirms in place rather than through a toast: the whole reason a quote id or
 * an address is copied is to paste it somewhere else immediately, and a
 * notification that covers the corner of the screen for six seconds is a worse
 * answer than a tick on the button that was just pressed.
 */
export function CopyAction({ value, label }: CopyActionProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <RowAction onClick={copy} title={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}>
      {copied ? (
        <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-hidden className="text-long">
          <path
            d="M2.5 6.4l2.4 2.4 4.6-5.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-hidden>
          <rect x="4" y="4" width="6.4" height="6.4" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
          <path
            d="M8 2.6A1.2 1.2 0 006.8 1.6H2.8a1.2 1.2 0 00-1.2 1.2v4a1.2 1.2 0 001 1.18"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      )}
    </RowAction>
  );
}
