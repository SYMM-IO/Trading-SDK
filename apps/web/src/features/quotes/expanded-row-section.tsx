"use client";

import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  /** Section name, rendered as the band's eyebrow (e.g. `Margin & risk`). */
  title: string;
  /** Status line beside the title — loading, completeness, warnings. Optional. */
  note?: ReactNode;
  /** The section's body. */
  children: ReactNode;
  /** Extra classes for the body wrapper, when a section needs different padding. */
  bodyClassName?: string;
}

/**
 * One titled section of a table row's expanded detail panel.
 *
 * A panel stacks several of these, so each section has to announce itself: the
 * title sits in a tinted band that spans the full row — the same tint the table
 * header uses — with the body padded beneath it. The band is what separates one
 * section from the next; the title is deliberately heavier and brighter than the
 * field labels inside the body, which are the same size and case and would
 * otherwise be indistinguishable from a section name.
 *
 * The left rail marks the whole thing as detail belonging to the row above, and
 * runs unbroken across stacked sections so the panel still reads as one.
 *
 * @example
 * <div className="flex flex-col [&>section+section]:border-t [&>section+section]:border-t-border/60">
 *   <ExpandedRowSection title="Margin & risk" note={<Spinner />}>…</ExpandedRowSection>
 *   <ExpandedRowSection title="Funding">…</ExpandedRowSection>
 * </div>
 */
export function ExpandedRowSection({ title, note, children, bodyClassName }: Props) {
  return (
    <section className="border-primary/40 border-l-2">
      {/* Left-packed, never `justify-between`: the expanded row spans a
          horizontally scrolling table, so anything pushed to the far edge lands
          off-screen. The band itself is uncapped so it reaches that far edge. */}
      <header className="bg-primary/6 border-border/60 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-2">
        <h4 className="text-foreground/85 text-[0.65rem] font-semibold tracking-[0.14em] uppercase">{title}</h4>
        {note}
      </header>
      <div className={cn("px-4 pt-3 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}
