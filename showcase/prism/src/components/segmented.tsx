"use client";

import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional swatch pair rendered before the label — used by the mode switch. */
  swatches?: readonly [string, string];
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `neutral` for a view switch, `tinted` for a mutually exclusive stance. */
  variant?: "neutral" | "tinted";
  size?: "sm" | "md";
  className?: string;
}

/**
 * Segmented control. Labels never move — only the selected cell re-tints.
 *
 * The design system defines two variants: `tinted` for a stance you are taking
 * (long/short), `neutral` for a view you are switching between.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = "neutral",
  size = "md",
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn("inline-flex gap-0.5 rounded-md border border-line bg-bg-0 p-[3px]", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border font-sans whitespace-nowrap",
              "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)]",
              size === "sm" ? "h-6 px-2.5 text-sm" : "h-[30px] px-3 text-sm",
              selected
                ? variant === "tinted"
                  ? "border-accent-bd bg-accent-bg font-semibold text-fg-0"
                  : "border-line-strong bg-bg-3 font-semibold text-fg-0"
                : "border-transparent text-fg-3 hover:text-fg-1",
            )}
          >
            {option.swatches ? (
              <span aria-hidden className="flex gap-[2px]">
                {option.swatches.map((swatch, index) => (
                  <span
                    key={index}
                    className="h-3 w-[6px] rounded-[1px] transition-opacity duration-[var(--dur-fast)]"
                    style={{ background: swatch, opacity: selected ? 1 : 0.34 }}
                  />
                ))}
              </span>
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
