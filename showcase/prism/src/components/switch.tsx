"use client";

import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/** Toggle. The knob and track take the accent when on. */
export function Switch({ checked, onChange, label, disabled = false, className }: SwitchProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2.5",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[19px] w-[34px] shrink-0 rounded-full border",
          "transition-all duration-[var(--dur-base)] ease-[var(--ease-out)]",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          checked ? "border-accent bg-accent-bg" : "border-line-strong bg-bg-0",
        )}
      >
        <span
          aria-hidden
          className="absolute top-[2px] size-[13px] rounded-full"
          style={{
            left: checked ? "17px" : "2px",
            background: checked ? "var(--accent)" : "var(--fg-3)",
            transition:
              "left var(--dur-base) cubic-bezier(0.34,1.3,0.64,1), background var(--dur-base) var(--ease-out)",
          }}
        />
      </button>
      {label ? <span className="text-base text-fg-1 select-none">{label}</span> : null}
    </label>
  );
}
