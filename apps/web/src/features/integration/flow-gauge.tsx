"use client";

import { cn } from "@symmio/ui/lib/utils";
import type { FlowStep } from "./flow-rail";

interface Props {
  steps: readonly FlowStep[];
  /** Index of the step currently in focus. */
  current: number;
  /** Highest step index the user is allowed to navigate to. */
  maxReachable: number;
  /** Navigate to a step. Segments at or before {@link Props.maxReachable} are clickable. */
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Condensed reading of {@link FlowRail} for a narrow console: a mono step
 * counter, the focused step's title and live hint, and one gauge segment per
 * step. Segments are the navigation, not decoration — each is a button gated by
 * the same {@link Props.maxReachable} rule as the full rail, so squeezing the
 * console never puts a step out of reach.
 */
export function FlowGauge({ steps, current, maxReachable, onStepClick, className }: Props) {
  const active = steps[current];
  const total = steps.length;

  return (
    <div
      className={cn("border-border/70 bg-muted/20 flex flex-col gap-2.5 rounded-xl border px-4 py-3", className)}
      data-testid="flow-gauge"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-foreground truncate text-sm font-medium">{active?.label}</p>
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums" aria-hidden>
          {pad(current + 1)}
          <span className="opacity-45">/{pad(total)}</span>
        </span>
      </div>

      <ol className="flex items-center gap-1" aria-label="Flow progress">
        {steps.map((step, index) => {
          const status = index === current ? "active" : step.done ? "done" : "pending";
          const reachable = Boolean(onStepClick) && index <= maxReachable;

          return (
            <li key={step.label} className="flex-1">
              <button
                type="button"
                disabled={!reachable}
                aria-current={index === current ? "step" : undefined}
                aria-label={`Step ${index + 1} of ${total}: ${step.label}`}
                onClick={() => onStepClick?.(index)}
                data-testid={`gauge-step-${index}`}
                className="focus-visible:ring-ring/40 block w-full rounded-sm py-2 outline-none focus-visible:ring-2 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none",
                    status === "active"
                      ? "bg-primary ring-primary/25 ring-2"
                      : status === "done"
                        ? "bg-primary/65"
                        : "bg-border",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>

      {active?.hint ? <p className="text-muted-foreground text-xs leading-5">{active.hint}</p> : null}
    </div>
  );
}

/** Two-digit step figure, so the counter never changes width as it advances. */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}
