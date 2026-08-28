import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  /** The chart — drawn first, so it is what a narrow layout shows before the rows. */
  chart: ReactNode;
  /** The table — the chart's WCAG twin; every value the chart plots is reachable here. */
  children: ReactNode;
  className?: string;
}

/**
 * A series chart beside its table. Side by side once the panel is wide enough
 * for both to breathe, stacked otherwise — decided by the panel's own width,
 * not the viewport, because the page width and the viewport are decoupled by
 * the docked sidebar.
 */
export function ChartWithTable({ chart, children, className }: Props) {
  return (
    <div className={cn("@container", className)}>
      <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">{chart}</div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
