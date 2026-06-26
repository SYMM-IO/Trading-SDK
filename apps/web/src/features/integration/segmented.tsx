"use client";

import { cn } from "@theoldvarorg/ui/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
}

/**
 * Refined two-or-more segmented control: a tinted track with a raised active
 * pill. Used for the Deposit / Withdraw flow switch on the Integration console.
 */
export function Segmented<T extends string>({ options, value, onChange, ...rest }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className="bg-muted/70 ring-border/70 inline-flex items-center gap-1 rounded-xl p-1 ring-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            data-testid={`tab-${option.value}`}
            className={cn(
              "focus-visible:ring-ring/40 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 motion-reduce:transition-none",
              active
                ? "bg-background text-foreground ring-border shadow-sm ring-1"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
