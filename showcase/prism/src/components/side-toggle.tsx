"use client";

import { cn } from "@/lib/cn";
import { PositionType } from "@symmio/trading-core";

export interface SideToggleProps {
  value: PositionType;
  onChange: (value: PositionType) => void;
  className?: string;
}

/**
 * Long/short stance switch.
 *
 * The thumb slides; the labels never move. Direction owns green and red, so
 * this control never touches the palette accent whatever mode is active.
 */
export function SideToggle({ value, onChange, className }: SideToggleProps) {
  const isLong = value === PositionType.LONG;

  return (
    <div className={cn("relative flex gap-0.5 rounded-lg border border-line bg-bg-0 p-[3px]", className)}>
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] rounded-md border"
        style={{
          left: isLong ? "3px" : "50%",
          background: isLong ? "var(--long-bg)" : "var(--short-bg)",
          borderColor: isLong ? "rgba(80,250,123,0.45)" : "rgba(255,85,85,0.45)",
          boxShadow: isLong ? "var(--shadow-long-glow)" : "var(--shadow-short-glow)",
          transition:
            "left var(--dur-base) cubic-bezier(0.34,1.2,0.64,1), background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
        }}
      />
      <button
        type="button"
        onClick={() => onChange(PositionType.LONG)}
        className={cn(
          "relative z-10 h-9 flex-1 cursor-pointer rounded-md font-sans text-md font-semibold",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          isLong ? "text-long" : "text-fg-3 hover:text-fg-1",
        )}
      >
        Long
      </button>
      <button
        type="button"
        onClick={() => onChange(PositionType.SHORT)}
        className={cn(
          "relative z-10 h-9 flex-1 cursor-pointer rounded-md font-sans text-md font-semibold",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          isLong ? "text-fg-3 hover:text-fg-1" : "text-short",
        )}
      >
        Short
      </button>
    </div>
  );
}
