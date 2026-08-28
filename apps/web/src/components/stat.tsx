import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /**
   * `default` is the headline figure in the display face; `sm` is a supporting
   * figure in mono, for the row of secondary numbers under a headline.
   */
  size?: "default" | "sm";
  /** Tint the value by sign — a signed rate or a P&L. */
  tone?: "positive" | "negative" | "neutral";
  testId?: string;
  className?: string;
}

const VALUE_SIZE: Record<NonNullable<Props["size"]>, string> = {
  default: "font-display text-4xl font-semibold",
  sm: "font-mono text-lg",
};

const VALUE_TONE: Record<NonNullable<Props["tone"]>, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-foreground",
};

/** A single figure with a label and optional supporting hint. */
export function Stat({ label, value, hint, size = "default", tone = "neutral", testId, className }: Props) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)} data-testid={testId}>
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
      <span className={cn("wrap-anywhere tabular-nums", VALUE_SIZE[size], VALUE_TONE[tone])}>{value}</span>
      {hint ? <span className="text-muted-foreground text-xs wrap-anywhere">{hint}</span> : null}
    </div>
  );
}
