"use client";

import { cn } from "@symmio/ui/lib/utils";

export interface FlowStep {
  /** Short step title. */
  label: string;
  /** Supporting line under the title — reflects live on-chain state. */
  hint?: string;
  /** Whether the step's completion condition is met. */
  done: boolean;
}

interface Props {
  steps: readonly FlowStep[];
  /** Index of the step currently in focus. */
  current: number;
  /** Highest step index the user is allowed to navigate to. */
  maxReachable: number;
  /** Navigate to a step. Steps at or before {@link Props.maxReachable} are clickable. */
  onStepClick?: (index: number) => void;
}

/**
 * Vertical step navigator for a wizard flow. The rail fills as steps complete,
 * the focused step is highlighted, and any reached step is clickable to jump back
 * (or forward within what's unlocked). Node state reflects real progress
 * (allowance detected, subaccount chosen, …), not a click counter.
 */
export function FlowRail({ steps, current, maxReachable, onStepClick }: Props) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const status = index === current ? "active" : step.done ? "done" : "pending";
        const clickable = Boolean(onStepClick) && index <= maxReachable && index !== current;

        const body = (
          <>
            <div className="flex flex-col items-center">
              <StepNode status={status} index={index} />
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "w-px flex-1 transition-colors duration-500",
                    step.done ? "bg-primary/60" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <div className={cn("pb-6 text-left", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium transition-colors",
                  status === "pending" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </p>
              {step.hint ? <p className="text-muted-foreground mt-0.5 text-xs leading-5">{step.hint}</p> : null}
            </div>
          </>
        );

        return (
          <li key={step.label}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                data-testid={`step-${index}`}
                className="focus-visible:ring-ring/40 grid w-full grid-cols-[auto_1fr] gap-x-3 rounded-md outline-none focus-visible:ring-2"
              >
                {body}
              </button>
            ) : (
              <div className="grid grid-cols-[auto_1fr] gap-x-3" data-testid={`step-${index}`}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepNode({ status, index }: { status: "done" | "active" | "pending"; index: number }) {
  if (status === "done") {
    return (
      <span className="bg-primary text-primary-foreground ring-primary/20 flex size-6 items-center justify-center rounded-full ring-4 transition-transform group-hover:scale-105">
        <CheckIcon />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="border-primary text-primary animate-pulse-ring bg-background flex size-6 items-center justify-center rounded-full border-2">
        <span className="bg-primary size-2 rounded-full" />
      </span>
    );
  }
  return (
    <span className="border-border text-muted-foreground bg-muted/40 flex size-6 items-center justify-center rounded-full border text-[0.7rem] font-medium tabular-nums">
      {index + 1}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path
        d="m4 8.5 2.5 2.5L12 5.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
