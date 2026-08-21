"use client";

import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Micro-label rendered inside the field, top-left. */
  label: string;
  /** Right-aligned caption on the label row — e.g. `AVAIL $15,420`. */
  hint?: ReactNode;
  /** Controls docked at the field's right edge, e.g. a unit switch. */
  adornment?: ReactNode;
  /** Sub-caption under the input, e.g. `≈ 0.0743 BTC`. */
  footnote?: ReactNode;
  /** Renders the field in an error state. */
  invalid?: boolean;
  className?: string;
}

/**
 * Text/number input.
 *
 * The label lives inside the field. Focus turns the border and the caption to
 * the accent — the system deliberately has no separate focus ring here.
 */
export function Field({ label, hint, adornment, footnote, invalid = false, className, ...rest }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "prism-field flex flex-col gap-1 rounded-md border bg-bg-2 px-3 py-2",
          invalid ? "border-[var(--short-500)]" : "border-line",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <span className="prism-cap text-2xs font-semibold tracking-[0.12em] text-fg-3 uppercase">{label}</span>
          {hint ? <span className="ml-auto text-2xs text-fg-3">{hint}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <input
            {...rest}
            className="tnum min-w-0 flex-1 bg-transparent text-lg font-semibold text-fg-0 outline-none placeholder:text-fg-3"
          />
          {adornment ? <div className="flex shrink-0 items-center gap-1">{adornment}</div> : null}
        </div>
      </div>
      {footnote ? <span className="px-1 text-2xs text-fg-3">{footnote}</span> : null}
    </div>
  );
}

export interface UnitSwitchProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Label for an option, when the value and the label differ. */
  render?: (value: T) => string;
}

/** Compact unit switch docked inside a field (USD / asset). */
export function UnitSwitch<T extends string>({ options, value, onChange, render }: UnitSwitchProps<T>) {
  return (
    <div className="flex gap-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "h-[22px] cursor-pointer rounded-xs border px-2 font-mono text-2xs whitespace-nowrap",
            "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)]",
            option === value ? "border-line-strong bg-bg-3 text-fg-0" : "border-transparent text-fg-3 hover:text-fg-1",
          )}
        >
          {render ? render(option) : option}
        </button>
      ))}
    </div>
  );
}
