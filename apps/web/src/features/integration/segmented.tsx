"use client";

import { cn } from "@symmio/ui/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  /**
   * Options split into related tracks. Each group gets its own pill, so the kind
   * of operation an option performs reads from the layout alone — no group
   * labels needed. Pass a single group for one plain track.
   */
  groups: readonly (readonly SegmentedOption<T>[])[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
}

/**
 * Flow switcher for the Integration console: tinted tracks with a raised active
 * pill. Both the row of tracks and each track wrap, so options reflow onto more
 * rows as the console narrows instead of clipping past its edge — every flow
 * stays visible and clickable at any console width.
 */
export function Segmented<T extends string>({ groups, value, onChange, ...rest }: Props<T>) {
  return (
    <div role="tablist" aria-label={rest["aria-label"]} className="flex flex-wrap items-start gap-2">
      {groups.map((group) => (
        <div
          key={group[0]?.value}
          role="presentation"
          className="bg-muted/70 ring-border/70 flex flex-wrap items-center gap-1 rounded-xl p-1 ring-1"
        >
          {group.map((option) => {
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
                  "focus-visible:ring-ring/40 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none focus-visible:ring-2 motion-reduce:transition-none @xl/console:px-4",
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
      ))}
    </div>
  );
}
