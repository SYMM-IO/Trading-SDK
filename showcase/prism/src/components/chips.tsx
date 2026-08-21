"use client";

import { cn } from "@/lib/cn";

export interface ChipsProps {
  options: readonly string[];
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Percentage quick-picks. Selected chip takes the accent tint. */
export function Chips({ options, value, onChange, className }: ChipsProps) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "h-7 flex-1 cursor-pointer rounded-md border font-mono text-sm",
            "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)]",
            option === value
              ? "border-accent-bd bg-accent-bg text-fg-0"
              : "border-line bg-bg-2 text-fg-2 hover:border-line-strong hover:text-fg-0",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
