"use client";

import { cn } from "@/lib/cn";
import { formatLeverage } from "@/lib/format";
import { MicroLabel } from "./panel";

export interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** The market's own ceiling, straight from the solver's `maxLeverage`. */
  max: number;
  min?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Leverage slider with a risk meter.
 *
 * The fill shifts accent → amber → red as leverage approaches the market
 * ceiling, and the pill names the risk in words — a number alone doesn't convey
 * proximity. The ceiling is the market's real `maxLeverage`, not a UI constant.
 */
export function LeverageSlider({ value, onChange, max, min = 1, disabled = false, className }: LeverageSliderProps) {
  const span = Math.max(1, max - min);
  const ratio = (value - min) / span;
  const risk = riskFor(ratio);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <MicroLabel>Leverage</MicroLabel>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-2xs font-semibold tracking-[0.12em] uppercase"
          style={{ background: risk.background, color: risk.color }}
        >
          {risk.label}
        </span>
        <span className="tnum w-12 text-right text-md font-semibold text-fg-0">{formatLeverage(value)}</span>
      </div>

      <div className="relative flex h-[22px] items-center">
        <span aria-hidden className="absolute right-0 left-0 h-[5px] rounded-full bg-bg-0" />
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 h-[5px] rounded-full"
          style={{
            width: `calc(${Math.min(100, Math.max(0, ratio * 100))}% - 2px)`,
            background: `linear-gradient(90deg, var(--accent), ${risk.fill})`,
            transition: "width var(--dur-fast) var(--ease-out)",
          }}
        />
        <input
          type="range"
          className="prism-range relative z-10"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>

      <div className="flex justify-between">
        <span className="tnum text-2xs text-fg-3">{formatLeverage(min)}</span>
        <span className="tnum text-2xs text-fg-3">max {formatLeverage(max)}</span>
      </div>
    </div>
  );
}

function riskFor(ratio: number) {
  if (ratio > 0.66) {
    return {
      label: "High risk",
      color: "var(--short-500)",
      background: "var(--short-bg)",
      fill: "var(--short-500)",
    };
  }
  if (ratio > 0.33) {
    return {
      label: "Moderate",
      color: "var(--warn-500)",
      background: "var(--warn-bg)",
      fill: "var(--warn-500)",
    };
  }
  return {
    label: "Conservative",
    color: "var(--long-500)",
    background: "var(--long-bg)",
    fill: "var(--accent-2)",
  };
}
