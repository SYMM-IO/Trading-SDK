"use client";

import { cn } from "@/lib/cn";

export interface ChipsProps {
  options: readonly string[];
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Percentage quick-picks. Selected chip takes the accent tint.
 *
 * ## Why the group takes `disabled`
 *
 * A chip does not submit anything — it rewrites the amount in the form beside
 * it. That makes it the one control that stays harmless-looking while a write is
 * in flight and is not: pressing 50% mid-transaction leaves the field showing a
 * number the pending mutation was never built from. So the group closes for the
 * duration of the write, exactly like the button that started it.
 *
 * The muted/not-allowed treatment is the same one `Button` uses — 40% opacity
 * and a `not-allowed` cursor — because a reader should not have to learn a
 * second vocabulary for "this is off right now". It is applied by swapping
 * classes rather than layering them: `cn` is a plain join with no conflict
 * resolution, so a `cursor-not-allowed` appended after `cursor-pointer` would be
 * a coin flip on source order, and the hover rules still match a disabled button
 * in CSS. Dropping the affordance classes instead of trying to out-rank them is
 * the only version that cannot lose.
 */
export function Chips({ options, value, onChange, disabled = false, className }: ChipsProps) {
  return (
    <div className={cn("flex gap-1.5", disabled && "opacity-40", className)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "h-7 flex-1 rounded-md border font-mono text-sm",
            "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)]",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            option === value
              ? "border-accent-bd bg-accent-bg text-fg-0"
              : disabled
                ? "border-line bg-bg-2 text-fg-2"
                : "border-line bg-bg-2 text-fg-2 hover:border-line-strong hover:text-fg-0",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
