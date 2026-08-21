import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface NumericProps {
  children: ReactNode;
  /** Color by sign: positive green, negative red, zero neutral. */
  signed?: number;
  /** Explicit tone override. */
  tone?: "default" | "muted" | "strong" | "long" | "short" | "warn" | "accent";
  size?: "sm" | "base" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const TONES: Record<NonNullable<NumericProps["tone"]>, string> = {
  default: "text-fg-1",
  muted: "text-fg-3",
  strong: "text-fg-0",
  long: "text-long",
  short: "text-short",
  warn: "text-warn",
  accent: "text-accent",
};

const SIZES: Record<NonNullable<NumericProps["size"]>, string> = {
  sm: "text-sm",
  base: "text-base",
  md: "text-md",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

/**
 * Any number that can tick, change, or be copied.
 *
 * Monospace and tabular, always — the design system's one non-negotiable rule
 * about numerals. `signed` colors by direction without the caller re-deriving it.
 */
export function Numeric({ children, signed, tone, size = "base", className }: NumericProps) {
  const resolved = tone ?? (signed === undefined ? "default" : signed > 0 ? "long" : signed < 0 ? "short" : "muted");

  return <span className={cn("tnum font-semibold", SIZES[size], TONES[resolved], className)}>{children}</span>;
}

export interface StatProps {
  label: string;
  value: ReactNode;
  /** Optional caption under the value. */
  sub?: ReactNode;
  className?: string;
}

/** Micro-label over a value. The header strip's unit of measure. */
export function Stat({ label, value, sub, className }: StatProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-2xs font-semibold tracking-[0.12em] whitespace-nowrap text-fg-3 uppercase">{label}</span>
      <span className="truncate">{value}</span>
      {sub ? <span className="truncate text-2xs text-fg-3">{sub}</span> : null}
    </div>
  );
}

export interface ReceiptRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Renders the row as a risk block with its own emphasis. */
  emphasis?: boolean;
}

/** One line in a receipt. Grouped by rules, not cards. */
export function ReceiptRow({ label, value, emphasis = false }: ReceiptRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className={cn("text-sm", emphasis ? "text-fg-1" : "text-fg-2")}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
