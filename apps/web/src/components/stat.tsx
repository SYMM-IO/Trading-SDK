import { cn } from "@symm-frontier/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}

/** A single headline figure with a label and optional supporting hint. */
export function Stat({ label, value, hint, className }: Props) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
      <span className="font-display text-foreground text-4xl font-semibold wrap-anywhere tabular-nums">{value}</span>
      {hint ? <span className="text-muted-foreground text-xs wrap-anywhere">{hint}</span> : null}
    </div>
  );
}
